import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Op } from 'sequelize';
import { Attendance } from '../database/models/attendance.model';
import { Employee } from '../database/models/employee.model';
import { User } from '../database/models/user.model';
import { PublicHoliday } from '../database/models/public-holiday.model';
import { WorkingDaysUtil } from '../common/utils/working-days.util';
import { SalaryCalculator } from '../common/utils/salary-calculator.util';
import { LeaveBalanceUtil } from '../common/utils/leave-balance.util';
import { AttendanceRulesUtil } from '../common/utils/attendance-rules.util';
import { MonthlyAttendanceSummary } from '../database/models/monthly-attendance-summary.model';

@Injectable()
export class AttendanceCronService {
  private readonly logger = new Logger(AttendanceCronService.name);

  constructor(
    @InjectModel(Attendance)
    private attendanceModel: typeof Attendance,
    @InjectModel(Employee)
    private employeeModel: typeof Employee,
    @InjectModel(PublicHoliday)
    private publicHolidayModel: typeof PublicHoliday,
    @InjectModel(MonthlyAttendanceSummary)
    private monthlySummaryModel: typeof MonthlyAttendanceSummary,
    private sequelize: Sequelize,
    private salaryCalculator: SalaryCalculator,
    private leaveBalanceUtil: LeaveBalanceUtil,
    private attendanceRules: AttendanceRulesUtil,
  ) {}

  /**
   * Cron job runs at 00:00 PKT (19:00 UTC previous day)
   * Pakistan Time (PKT) is UTC+5, so 00:00 PKT = 19:00 UTC previous day
   */
  @Cron('0 19 * * *', {
    name: 'auto-checkout-midnight',
    timeZone: 'Asia/Karachi',
  })
  async handleAutoCheckout() {
    this.logger.log('Starting auto-checkout cron job at 00:00 PKT');

    try {
      // Get yesterday's date in PKT
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      // Get all employees who checked in yesterday but didn't check out
      const employeesToCheckout = await this.employeeModel.findAll({
        where: { deletedAt: null },
        include: [
          {
            model: User,
            as: 'user',
            where: { deletedAt: null, isActive: true },
            required: true,
          },
        ],
      });

      let checkedOutCount = 0;

      for (const employee of employeesToCheckout) {
        const transaction = await this.sequelize.transaction();
        try {
          const attendance = await this.attendanceModel.findOne({
            where: {
              employeeId: employee.id,
              date: yesterday,
              checkInTime: { [Op.not]: null },
              checkOutTime: null,
              deletedAt: null,
            },
            transaction,
          });

          if (attendance) {
            // Auto checkout at end of day (23:59:59)
            const checkOutTime = new Date(yesterday);
            checkOutTime.setHours(23, 59, 59, 999);

            const checkInTime = attendance.checkInTime;

            // Calculate monthly short minutes
            const month = checkOutTime.getMonth() + 1;
            const year = checkOutTime.getFullYear();

            // Get monthly short minutes (excluding this attendance)
            const monthlyShortMinutes = await this.getMonthlyShortMinutes(
              employee.id,
              month,
              year,
              attendance.id,
              transaction,
            );

            // Get available leave balance
            const leaveBalance = await this.leaveBalanceUtil.getCurrentBalance(
              employee.id,
              month,
              year,
              employee.joiningDate,
            );

            if (!checkInTime) {
              throw new Error('Check-in time is null');
            }

            const attendanceDate = new Date(attendance.date);
            const isLate = (attendance as any).isLate ?? this.attendanceRules.isLate(checkInTime, attendanceDate);
            const isHalfDay = (attendance as any).isHalfDay ?? this.attendanceRules.isHalfDay(checkInTime, attendanceDate);

            const calculation = this.salaryCalculator.calculateSalary(
              checkInTime,
              checkOutTime,
              attendanceDate,
              isHalfDay,
              parseFloat(employee.dailySalary.toString()),
              monthlyShortMinutes,
              leaveBalance.availableMinutes,
            );

            if (calculation.shortMinutes > 0 && leaveBalance.availableMinutes > 0) {
              const minutesToUtilize = Math.min(
                calculation.shortMinutes,
                leaveBalance.availableMinutes,
              );
              await this.leaveBalanceUtil.utilizeLeave(
                employee.id,
                month,
                year,
                minutesToUtilize,
              );
            }

            await attendance.update(
              {
                checkOutTime: checkOutTime,
                totalWorkedMinutes: calculation.totalWorkedMinutes,
                shortMinutes: calculation.shortMinutes,
                salaryEarned: calculation.salaryEarned,
                isActive: true,
                isLate: (attendance as any).isLate ?? isLate,
                isHalfDay: (attendance as any).isHalfDay ?? isHalfDay,
              },
              { transaction },
            );

            // Recalculate monthly summary
            await this.recalculateMonthlySummary(
              employee.id,
              month,
              year,
              transaction,
            );

            checkedOutCount++;
            this.logger.log(
              `Auto-checked out employee ${employee.fullName} (${employee.id}) for ${yesterday.toISOString().split('T')[0]}`,
            );
          }

          await transaction.commit();
        } catch (error) {
          await transaction.rollback();
          this.logger.error(
            `Error auto-checking out employee ${employee.fullName} (${employee.id}): ${error.message}`,
            error.stack,
          );
        }
      }

      this.logger.log(
        `Auto-checkout cron job completed. Checked out ${checkedOutCount} employees.`,
      );
    } catch (error) {
      this.logger.error(`Error in auto-checkout cron job: ${error.message}`, error.stack);
    }
  }

  /**
   * Cron job runs at 00:00 PKT to create inactive records for current day
   * and activate previous inactive records
   */
  @Cron('0 0 * * *', {
    name: 'create-inactive-records',
    timeZone: 'Asia/Karachi',
  })
  async handleCreateInactiveRecords() {
    this.logger.log('Starting create inactive records cron job at 00:00 PKT');

    try {
      const now = new Date();
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);

      // Get public holidays
      const publicHolidays = await this.publicHolidayModel.findAll({
        where: {
          date: today,
        },
      });

      const isPublicHoliday = publicHolidays.length > 0;
      const dayOfWeek = today.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday = 0, Saturday = 6
      const isWorkingDay = !isWeekend && !isPublicHoliday;

      if (isWorkingDay) {
        // Get all active employees
        const employees = await this.employeeModel.findAll({
          where: { deletedAt: null },
          include: [
            {
              model: User,
              as: 'user',
              where: { deletedAt: null, isActive: true },
              required: true,
            },
          ],
        });

        let createdCount = 0;

        for (const employee of employees) {
          const transaction = await this.sequelize.transaction();
          try {
            // Check if record already exists for today
            const existingAttendance = await this.attendanceModel.findOne({
              where: {
                employeeId: employee.id,
                date: today,
                deletedAt: null,
              },
              transaction,
            });

            if (!existingAttendance) {
              // Create inactive record for today
              await this.attendanceModel.create(
                {
                  employeeId: employee.id,
                  date: today,
                  checkInTime: null,
                  checkOutTime: null,
                  totalWorkedMinutes: null,
                  shortMinutes: null,
                  salaryEarned: null,
                  unpaidLeave: false,
                  isPublicHoliday: false,
                  isActive: false, // Inactive until check-in
                } as any,
                { transaction },
              );

              createdCount++;
              this.logger.log(
                `Created inactive attendance record for employee ${employee.fullName} (${employee.id}) for ${today.toISOString().split('T')[0]}`,
              );
            }

            await transaction.commit();
          } catch (error) {
            await transaction.rollback();
            this.logger.error(
              `Error creating inactive record for employee ${employee.fullName} (${employee.id}): ${error.message}`,
              error.stack,
            );
          }
        }

        this.logger.log(
          `Created ${createdCount} inactive attendance records for today.`,
        );
      }

      // Activate previous inactive records (all past dates)
      await this.activatePreviousInactiveRecords();

      this.logger.log('Create inactive records cron job completed.');
    } catch (error) {
      this.logger.error(
        `Error in create inactive records cron job: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Activate all previous inactive attendance records
   */
  private async activatePreviousInactiveRecords() {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    try {
      const result = await this.attendanceModel.update(
        {
          isActive: true,
        },
        {
          where: {
            isActive: false,
            date: {
              [Op.lt]: today, // All dates before today
            },
            deletedAt: null,
          },
        },
      );

      if (result[0] > 0) {
        this.logger.log(
          `Activated ${result[0]} previous inactive attendance records.`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error activating previous inactive records: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Get monthly short minutes excluding a specific attendance
   */
  private async getMonthlyShortMinutes(
    employeeId: string,
    month: number,
    year: number,
    excludeAttendanceId: string,
    transaction: any,
  ): Promise<number> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const attendances = await this.attendanceModel.findAll({
      where: {
        employeeId,
        date: {
          [Op.between]: [startDate, endDate],
        },
        id: {
          [Op.ne]: excludeAttendanceId,
        },
        checkOutTime: {
          [Op.not]: null,
        },
        deletedAt: null,
      } as any,
      attributes: ['shortMinutes'],
      transaction,
    });

    return attendances.reduce(
      (sum, att) => sum + (att.shortMinutes || 0),
      0,
    );
  }

  /**
   * Recalculate monthly summary
   */
  private async recalculateMonthlySummary(
    employeeId: string,
    month: number,
    year: number,
    transaction: any,
  ): Promise<void> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const attendances = await this.attendanceModel.findAll({
      where: {
        employeeId,
        date: {
          [Op.between]: [startDate, endDate],
        },
        checkOutTime: {
          [Op.not]: null,
        },
        deletedAt: null,
      } as any,
      transaction,
    });

    const totalWorkedMinutes = attendances.reduce(
      (sum, att) => sum + (att.totalWorkedMinutes || 0),
      0,
    );

    const totalShortMinutes = attendances.reduce(
      (sum, att) => sum + (att.shortMinutes || 0),
      0,
    );

    const totalSalaryEarned = attendances.reduce(
      (sum, att) => sum + parseFloat(att.salaryEarned?.toString() || '0'),
      0,
    );

    const [summary] = await this.monthlySummaryModel.findOrCreate({
      where: { employeeId, month, year },
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
        totalWorkedMinutes,
        totalShortMinutes,
        totalSalaryEarned,
      },
      { transaction },
    );
  }
}

