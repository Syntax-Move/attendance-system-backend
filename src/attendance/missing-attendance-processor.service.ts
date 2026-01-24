import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Op } from 'sequelize';
import { Attendance } from '../database/models/attendance.model';
import { Employee } from '../database/models/employee.model';
import { PublicHoliday } from '../database/models/public-holiday.model';
import { LeaveBalance } from '../database/models/leave-balance.model';
import { MonthlyAttendanceSummary } from '../database/models/monthly-attendance-summary.model';
import { WorkingDaysUtil } from '../common/utils/working-days.util';
import { LeaveBalanceUtil } from '../common/utils/leave-balance.util';

@Injectable()
export class MissingAttendanceProcessorService {
  private readonly REQUIRED_MINUTES_PER_DAY = 9 * 60; // 9 hours = 540 minutes

  constructor(
    @InjectModel(Attendance)
    private attendanceModel: typeof Attendance,
    @InjectModel(Employee)
    private employeeModel: typeof Employee,
    @InjectModel(PublicHoliday)
    private publicHolidayModel: typeof PublicHoliday,
    @InjectModel(LeaveBalance)
    private leaveBalanceModel: typeof LeaveBalance,
    @InjectModel(MonthlyAttendanceSummary)
    private monthlySummaryModel: typeof MonthlyAttendanceSummary,
    private sequelize: Sequelize,
    private leaveBalanceUtil: LeaveBalanceUtil,
  ) {}

  /**
   * Process missing attendance for a specific employee and month
   * This will:
   * 1. Find all working days in the month (excluding public holidays)
   * 2. Check which days don't have attendance records
   * 3. For missing days:
   *    - First try to deduct from leave balance (if available)
   *    - If leave balance is 0, count as short minutes (full day = 540 minutes)
   */
  async processMissingAttendance(
    employeeId: string,
    month: number,
    year: number,
  ): Promise<{
    processedDays: number;
    leaveDeducted: number;
    shortMinutesAdded: number;
  }> {
    const transaction = await this.sequelize.transaction();

    try {
      // Get employee
      const employee = await this.employeeModel.findByPk(employeeId, { transaction });
      if (!employee) {
        throw new Error(`Employee ${employeeId} not found`);
      }

      // Get public holidays for the month
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      const publicHolidays = await this.publicHolidayModel.findAll({
        where: {
          date: {
            [Op.between]: [
              startDate.toISOString().split('T')[0],
              endDate.toISOString().split('T')[0],
            ],
          },
        },
        attributes: ['date'],
        transaction,
      });

      const holidayDates = publicHolidays.map((h) => h.date.toISOString().split('T')[0]);

      // Get all working days in the month
      const workingDays = WorkingDaysUtil.getWorkingDays(month, year, holidayDates);

      // Filter working days up to today (don't process future dates)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const workingDaysToProcess = workingDays.filter((day) => day <= today);

      // Get existing attendance records for the month
      const existingAttendances = await this.attendanceModel.findAll({
        where: {
          employeeId,
          date: {
            [Op.between]: [
              startDate.toISOString().split('T')[0],
              endDate.toISOString().split('T')[0],
            ],
          },
          deletedAt: null,
        },
        attributes: ['date'],
        transaction,
      });

      const existingDates = existingAttendances.map((att) =>
        att.date.toISOString().split('T')[0],
      );

      // Find missing working days
      const missingDays = workingDaysToProcess.filter((day) => {
        const dateStr = day.toISOString().split('T')[0];
        return !existingDates.includes(dateStr);
      });

      if (missingDays.length === 0) {
        await transaction.commit();
        return {
          processedDays: 0,
          leaveDeducted: 0,
          shortMinutesAdded: 0,
        };
      }

      // Get current leave balance
      const leaveBalance = await this.leaveBalanceUtil.getOrCreateLeaveBalance(
        employeeId,
        month,
        year,
        employee.joiningDate,
      );

      let leaveDeducted = 0;
      let shortMinutesAdded = 0;

      // Process each missing day
      for (const missingDay of missingDays) {
        const minutesForDay = this.REQUIRED_MINUTES_PER_DAY; // 540 minutes (9 hours)

        // Calculate available minutes: balanceMinutes + carryoverMinutes - utilizedMinutes
        const availableMinutes = leaveBalance.balanceMinutes + leaveBalance.carryoverMinutes - leaveBalance.utilizedMinutes;

        // Try to deduct from leave balance first
        if (availableMinutes > 0) {
          const minutesToDeduct = Math.min(minutesForDay, availableMinutes);
          await this.leaveBalanceUtil.utilizeLeave(
            employeeId,
            month,
            year,
            minutesToDeduct,
          );
          leaveDeducted += minutesToDeduct;

          // If there are remaining minutes after leave deduction, add to short minutes
          const remainingMinutes = minutesForDay - minutesToDeduct;
          if (remainingMinutes > 0) {
            shortMinutesAdded += remainingMinutes;
          }
        } else {
          // No leave balance available, count as short minutes
          shortMinutesAdded += minutesForDay;
        }

        // Reload leave balance for next iteration
        const updatedBalance = await this.leaveBalanceUtil.getOrCreateLeaveBalance(
          employeeId,
          month,
          year,
          employee.joiningDate,
        );
        leaveBalance.balanceMinutes = updatedBalance.balanceMinutes;
        leaveBalance.carryoverMinutes = updatedBalance.carryoverMinutes;
        leaveBalance.utilizedMinutes = updatedBalance.utilizedMinutes;
      }

      // Update monthly summary with new short minutes
      if (shortMinutesAdded > 0) {
        const [summary] = await this.monthlySummaryModel.findOrCreate({
          where: {
            employeeId,
            month,
            year,
          },
          defaults: {
            employeeId,
            month,
            year,
            totalWorkedMinutes: 0,
            totalShortMinutes: 0,
            totalSalaryEarned: 0,
          } as any,
          transaction,
        });

        await summary.update(
          {
            totalShortMinutes: (summary.totalShortMinutes || 0) + shortMinutesAdded,
          },
          { transaction },
        );
      }

      await transaction.commit();

      return {
        processedDays: missingDays.length,
        leaveDeducted,
        shortMinutesAdded,
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Process missing attendance for all employees in a specific month
   */
  async processMissingAttendanceForAllEmployees(
    month: number,
    year: number,
  ): Promise<{
    totalProcessed: number;
    employeesProcessed: number;
  }> {
    const employees = await this.employeeModel.findAll({
      where: {
        deletedAt: null,
      },
    });

    let totalProcessed = 0;
    let employeesProcessed = 0;

    for (const employee of employees) {
      try {
        const result = await this.processMissingAttendance(
          employee.id,
          month,
          year,
        );
        if (result.processedDays > 0) {
          totalProcessed += result.processedDays;
          employeesProcessed++;
        }
      } catch (error) {
        console.error(
          `Error processing missing attendance for employee ${employee.id}:`,
          error,
        );
        // Continue with other employees even if one fails
      }
    }

    return {
      totalProcessed,
      employeesProcessed,
    };
  }

  /**
   * Process missing attendance for current month (up to today)
   */
  async processCurrentMonthMissingAttendance(employeeId?: string): Promise<any> {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    if (employeeId) {
      return this.processMissingAttendance(employeeId, currentMonth, currentYear);
    } else {
      return this.processMissingAttendanceForAllEmployees(currentMonth, currentYear);
    }
  }
}

