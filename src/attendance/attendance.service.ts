import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Op } from 'sequelize';
import { Attendance } from '../database/models/attendance.model';
import { Employee } from '../database/models/employee.model';
import { User } from '../database/models/user.model';
import { MonthlyAttendanceSummary } from '../database/models/monthly-attendance-summary.model';
import { SalaryDeductionLedger } from '../database/models/salary-deduction-ledger.model';
import { LeaveRequest } from '../database/models/leave-request.model';
import { LeaveBalance } from '../database/models/leave-balance.model';
import { PublicHoliday } from '../database/models/public-holiday.model';
import { SalaryCalculator } from '../common/utils/salary-calculator.util';
import { LeaveBalanceUtil } from '../common/utils/leave-balance.util';
import { WorkingDaysUtil } from '../common/utils/working-days.util';
import { Inject } from '@nestjs/common';
import { QRCodeValidator } from '../common/utils/qr-code-validator.util';
import { CheckInResponseDto } from './dto/check-in-response.dto';
import { CheckOutResponseDto } from './dto/check-out-response.dto';
import { AttendanceHistoryQueryDto } from './dto/attendance-history-query.dto';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectModel(Attendance)
    private attendanceModel: typeof Attendance,
    @InjectModel(Employee)
    private employeeModel: typeof Employee,
    @InjectModel(MonthlyAttendanceSummary)
    private monthlySummaryModel: typeof MonthlyAttendanceSummary,
    @InjectModel(SalaryDeductionLedger)
    private deductionLedgerModel: typeof SalaryDeductionLedger,
    @InjectModel(LeaveRequest)
    private leaveRequestModel: typeof LeaveRequest,
    @InjectModel(LeaveBalance)
    private leaveBalanceModel: typeof LeaveBalance,
    @InjectModel(PublicHoliday)
    private publicHolidayModel: typeof PublicHoliday,
    private sequelize: Sequelize,
    private salaryCalculator: SalaryCalculator,
    private leaveBalanceUtil: LeaveBalanceUtil,
  ) {}

  async checkIn(
    employeeId: string,
    checkInDto: CheckInDto,
  ): Promise<CheckInResponseDto> {
    // Verify employee exists and is active (not deleted)
    const employee = (
      await this.employeeModel.findOne({
        where: {
          id: employeeId,
          deletedAt: null, // Exclude deleted employees
        },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'email', 'role', 'isActive'],
            where: {
              deletedAt: null, // Exclude deleted users
            },
            required: true,
          },
        ],
      })
    )?.get({ plain: true });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    if (!employee?.user?.isActive) {
      throw new ForbiddenException('Employee account is inactive');
    }

    // Parse and validate check-in datetime
    const checkInDateTime = new Date(checkInDto.checkInDateTime);
    if (isNaN(checkInDateTime.getTime())) {
      throw new BadRequestException('Invalid check-in datetime');
    }

    // Validate QR code
    const qrValidation = QRCodeValidator.validateQRCode(
      checkInDto.qrCode,
      checkInDateTime,
    );
    if (!qrValidation.isValid) {
      throw new BadRequestException(`Invalid QR code: ${qrValidation.error}`);
    }

    // Get today's date from check-in datetime
    const today = new Date(checkInDateTime);
    today.setHours(0, 0, 0, 0);

    // Check if attendance already exists for today
    const existingAttendance = await this.attendanceModel.findOne({
      where: {
        employeeId,
        date: today,
      },
    });

    let attendance;
    if (existingAttendance) {
      // If record exists but is inactive, activate it and add check-in
      if (!existingAttendance.isActive) {
        await existingAttendance.update({
          isActive: true,
          checkInTime: checkInDateTime,
        });
        attendance = existingAttendance;
      } else if (existingAttendance.checkInTime) {
        throw new BadRequestException('Already checked in today');
      } else {
        // Active record but no check-in, update it
        await existingAttendance.update({
          checkInTime: checkInDateTime,
        });
        attendance = existingAttendance;
      }
    } else {
      // Create new check-in record (active)
      attendance = await this.attendanceModel.create({
        employeeId,
        date: today,
        checkInTime: checkInDateTime,
        isActive: true,
      } as any);
    }

    return {
      id: attendance.id,
      employeeId: attendance.employeeId,
      date: attendance.date?.toISOString?.(),
      checkInTime: attendance.checkInTime,
      message: 'Check-in successful',
    };
  }

  async checkOut(
    employeeId: string,
    checkOutDto: CheckOutDto,
  ): Promise<CheckOutResponseDto> {
    // Verify employee exists and is active
    const employee = (
      await this.employeeModel.findByPk(employeeId, {
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'email', 'role', 'isActive'],
          },
        ],
      })
    )?.get({ plain: true });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    if (!employee.user?.isActive) {
      throw new ForbiddenException('Employee account is inactive');
    }

    // Parse and validate check-out datetime
    const checkOutDateTime = new Date(checkOutDto.checkOutDateTime);
    if (isNaN(checkOutDateTime.getTime())) {
      throw new BadRequestException('Invalid check-out datetime');
    }

    // Validate QR code
    const qrValidation = QRCodeValidator.validateQRCode(
      checkOutDto.qrCode,
      checkOutDateTime,
    );
    if (!qrValidation.isValid) {
      throw new BadRequestException(`Invalid QR code: ${qrValidation.error}`);
    }

    // Get today's date from check-out datetime
    const today = new Date(checkOutDateTime);
    today.setHours(0, 0, 0, 0);

    // Find today's attendance (keep as model instance for update)
    const attendance = await this.attendanceModel.findOne({
      where: {  
        employeeId,
        date: today,
      },
    });
    if (!attendance) {
      throw new BadRequestException('No check-in found for today');
    }

    if (attendance.checkOutTime) {
      throw new BadRequestException('Already checked out today');
    }

    if (!attendance.checkInTime) {
      throw new BadRequestException('Invalid attendance record');
    }

    // Validate check-out time is after check-in time
    if (checkOutDateTime <= attendance.checkInTime) {
      throw new BadRequestException(
        'Check-out time must be after check-in time',
      );
    }

    const transaction = await this.sequelize.transaction();

    try {
      const checkOutTime = checkOutDateTime;
      const checkInTime = attendance.checkInTime;

      // Calculate monthly short minutes so far (excluding today)
      const currentMonth = checkOutTime.getMonth() + 1;
      const currentYear = checkOutTime.getFullYear();

      const monthlyShortMinutes = await this.getMonthlyShortMinutes(
        employeeId,
        currentMonth,
        currentYear,
        attendance.id,
        transaction,
      );

      // Get available leave balance
      const leaveBalance = await this.leaveBalanceUtil.getCurrentBalance(
        employeeId,
        currentMonth,
        currentYear,
        employee.joiningDate,
      );

      // Calculate salary (considering leave balance)
      const calculation = this.salaryCalculator.calculateSalary(
        checkInTime,
        checkOutTime,
        parseFloat(employee.dailySalary.toString()),
        monthlyShortMinutes,
        leaveBalance.availableMinutes,
      );

      // If there are short minutes, try to utilize leave balance
      if (calculation.shortMinutes > 0 && leaveBalance.availableMinutes > 0) {
        const minutesToUtilize = Math.min(calculation.shortMinutes, leaveBalance.availableMinutes);
        await this.leaveBalanceUtil.utilizeLeave(
          employeeId,
          currentMonth,
          currentYear,
          minutesToUtilize,
        );
      }

      // Update attendance record
      await attendance.update(
        {
          checkOutTime,
          totalWorkedMinutes: calculation.totalWorkedMinutes,
          shortMinutes: calculation.shortMinutes,
          salaryEarned: calculation.salaryEarned,
        },
        { transaction },
      );

      // Create deduction ledger entry if there's a deduction
      if (calculation.deductionMinutes > 0) {
        await this.deductionLedgerModel.create(
          {
            employeeId,
            attendanceId: attendance.id,
            deductedMinutes: calculation.deductionMinutes,
            deductedAmount: calculation.deductedAmount,
            reason: `Short hours deduction for ${attendance?.date}`,
          } as any,
          { transaction },
        );
      }

      // Update or create monthly summary
      await this.updateMonthlySummary(
        employeeId,
        currentMonth,
        currentYear,
        calculation,
        transaction,
      );

      await transaction.commit();

      return {
        id: attendance.id,
        employeeId: attendance.employeeId,
        date: attendance.date?.toISOString?.(),
        checkInTime: attendance.checkInTime,
        checkOutTime,
        totalWorkedMinutes: calculation.totalWorkedMinutes,
        shortMinutes: calculation.shortMinutes,
        salaryEarned: calculation.salaryEarned,
        message: 'Check-out successful',
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async getMyHistory(
    employeeId: string,
    query: AttendanceHistoryQueryDto,
  ): Promise<any[]> {
    // Always ensure current month's past working days have records (as unpaid leave)
    await this.ensureCurrentMonthPastWorkingDays(employeeId);

    const whereClause: any = { employeeId };
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    if (query.startDate && query.endDate) {
      startDate = new Date(query.startDate);
      endDate = new Date(query.endDate);
      whereClause.date = {
        [Op.between]: [startDate, endDate],
      };
    } else if (query.month && query.year) {
      startDate = new Date(query.year, query.month - 1, 1);
      endDate = new Date(query.year, query.month, 0);
      whereClause.date = {
        [Op.between]: [startDate, endDate],
      };
    }

    const attendances = await this.attendanceModel.findAll({
      where: {
        ...whereClause,
        deletedAt: null, // Exclude deleted attendances
      },
      include: [
        {
          model: Employee,
          attributes: ['id', 'fullName', 'designation'],
          where: {
            deletedAt: null, // Exclude deleted employees
          },
          required: true,
        },
      ],
      order: [['date', 'DESC']],
    });

    return attendances.map((att) => att.get({ plain: true }));
  }

  async getTodayAttendance(employeeId: string): Promise<{
    attendance: any | null;
    action: 'check-in' | 'check-out' | 'none';
    message: string;
  }> {
    // Always ensure current month's past working days have records (as unpaid leave)
    await this.ensureCurrentMonthPastWorkingDays(employeeId);
    
    // Ensure today has an inactive record if it's a working day
    await this.ensureTodayInactiveRecord(employeeId);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = (
      await this.attendanceModel.findOne({
        where: {
          employeeId,
          date: today,
        },
      })
    )?.get({ plain: true });

    if (!attendance) {
      return {
        attendance: null,
        action: 'check-in',
        message: 'No attendance record for today. You can check in.',
      };
    }

    if (!attendance.checkOutTime) {
      return {
        attendance,
        action: 'check-out',
        message: 'You have checked in. You can now check out.',
      };
    }

    return {
      attendance,
      action: 'none',
      message: 'You have already completed check-in and check-out for today.',
    };
  }

  async getAllAttendance(query: {
    employeeId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<any[]> {
    // Always ensure current month's past working days have records (as unpaid leave)
    await this.ensureCurrentMonthPastWorkingDays(query.employeeId);

    const whereClause: any = {
      deletedAt: null, // Exclude deleted attendances
    };

    if (query.employeeId) {
      whereClause.employeeId = query.employeeId;
    }

    let startDate: Date | null = null;
    let endDate: Date | null = null;

    if (query.startDate && query.endDate) {
      startDate = new Date(query.startDate);
      endDate = new Date(query.endDate);
      whereClause.date = {
        [Op.between]: [startDate, endDate],
      };
    }

    const attendances = await this.attendanceModel.findAll({
      where: whereClause,
      include: [
        {
          model: Employee,
          attributes: ['id', 'fullName', 'designation', 'phone'],
          where: {
            deletedAt: null, // Exclude deleted employees
          },
          required: true,
          include: [
            {
              model: Employee.associations.user.target,
              as: 'user',
              attributes: ['id', 'email'],
              where: {
                deletedAt: null, // Exclude deleted users
              },
              required: true,
            },
          ],
        },
      ],
      order: [['date', 'DESC']],
    });

    return attendances.map((att) => att.get({ plain: true }));
  }

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
      } as any,
      attributes: ['shortMinutes'],
      transaction,
    });

    return attendances.reduce((sum, att) => sum + (att.shortMinutes || 0), 0);
  }

  private async updateMonthlySummary(
    employeeId: string,
    month: number,
    year: number,
    calculation: any,
    transaction: any,
  ): Promise<void> {
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

    // Get all attendances for this month to recalculate totals
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
      } as any,
      transaction,
    });

    const totals = attendances.reduce(
      (acc, att) => ({
        totalWorkedMinutes:
          acc.totalWorkedMinutes + (att.totalWorkedMinutes || 0),
        totalShortMinutes: acc.totalShortMinutes + (att.shortMinutes || 0),
        totalSalaryEarned:
          acc.totalSalaryEarned +
          parseFloat(att.salaryEarned?.toString() || '0'),
      }),
      { totalWorkedMinutes: 0, totalShortMinutes: 0, totalSalaryEarned: 0 },
    );

    await summary.update(
      {
        totalWorkedMinutes: totals.totalWorkedMinutes,
        totalShortMinutes: totals.totalShortMinutes,
        totalSalaryEarned: totals.totalSalaryEarned,
      },
      { transaction },
    );
  }

  async deleteAttendanceById(id: string): Promise<{ message: string }> {
    const attendance = await this.attendanceModel.findOne({
      where: {
        id,
        deletedAt: null, // Only find non-deleted records
      },
    });

    if (!attendance) {
      throw new NotFoundException('Attendance record not found');
    }

    const transaction = await this.sequelize.transaction();

    try {
      const employeeId = attendance.employeeId;
      const attendanceDate = new Date(attendance.date);
      const month = attendanceDate.getMonth() + 1;
      const year = attendanceDate.getFullYear();

      // Soft delete the attendance
      await attendance.update({ deletedAt: new Date() }, { transaction });

      // Recalculate monthly summary if attendance had check-out
      if (attendance.checkOutTime) {
        await this.recalculateMonthlySummary(
          employeeId,
          month,
          year,
          transaction,
        );
      }

      await transaction.commit();

      return {
        message: 'Attendance record deleted successfully. Related records updated.',
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async deleteAllAttendances(): Promise<{ message: string; deletedCount: number }> {
    const transaction = await this.sequelize.transaction();

    try {
      // Get all attendances before deletion to recalculate summaries
      const allAttendances = await this.attendanceModel.findAll({
        where: {
          checkOutTime: {
            [Op.ne]: null,
          },
        } as any,
        transaction,
      });

      // Group by employee, month, and year for recalculation
      // Use Map to store unique combinations (employeeId, month, year)
      const summaryKeysMap = new Map<string, { employeeId: string; month: number; year: number }>();
      allAttendances.forEach((att) => {
        const date = new Date(att.date);
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        const key = `${att.employeeId}::${month}::${year}`;
        if (!summaryKeysMap.has(key)) {
          summaryKeysMap.set(key, { employeeId: att.employeeId, month, year });
        }
      });

      // Delete all attendances (cascade will handle related records)
      const deletedCount = await this.attendanceModel.destroy({
        where: {},
        transaction,
      });

      // Recalculate all affected monthly summaries
      const recalculationPromises = Array.from(summaryKeysMap.values()).map(({ employeeId, month, year }) => {
        return this.recalculateMonthlySummary(
          employeeId,
          month,
          year,
          transaction,
        );
      });

      await Promise.all(recalculationPromises);

      await transaction.commit();

      return {
        message: 'All attendance records deleted successfully. Related records updated.',
        deletedCount,
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  private async recalculateMonthlySummary(
    employeeId: string,
    month: number,
    year: number,
    transaction: any,
  ): Promise<void> {
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

    // Get all attendances for this month to recalculate totals
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
      } as any,
      transaction,
    });

    const totals = attendances.reduce(
      (acc, att) => ({
        totalWorkedMinutes:
          acc.totalWorkedMinutes + (att.totalWorkedMinutes || 0),
        totalShortMinutes: acc.totalShortMinutes + (att.shortMinutes || 0),
        totalSalaryEarned:
          acc.totalSalaryEarned +
          parseFloat(att.salaryEarned?.toString() || '0'),
      }),
      { totalWorkedMinutes: 0, totalShortMinutes: 0, totalSalaryEarned: 0 },
    );

    await summary.update(
      {
        totalWorkedMinutes: totals.totalWorkedMinutes,
        totalShortMinutes: totals.totalShortMinutes,
        totalSalaryEarned: totals.totalSalaryEarned,
      },
      { transaction },
    );
  }

  /**
   * Get user dashboard/info with current month stats
   */
  async getUserDashboard(employeeId: string): Promise<any> {
    // Always ensure current month's past working days have records (as unpaid leave)
    await this.ensureCurrentMonthPastWorkingDays(employeeId);

    const employee = await this.employeeModel.findByPk(employeeId, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'role', 'isActive'],
        },
      ],
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    // Get current month summary
    const monthlySummary = await this.monthlySummaryModel.findOne({
      where: {
        employeeId,
        month: currentMonth,
        year: currentYear,
      },
    });

    // Get current month attendances (up to today)
    const startDate = new Date(currentYear, currentMonth - 1, 1);
    const endDate = new Date(today);
    endDate.setHours(23, 59, 59, 999);

    // Get public holidays for current month (before using holidayDates)
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
    });
    const holidayDates = publicHolidays.map((h) => h.date.toISOString().split('T')[0]);

    const currentMonthAttendances = await this.attendanceModel.findAll({
      where: {
        employeeId,
        date: {
          [Op.between]: [startDate, endDate],
        },
        // checkOutTime: {
        //   [Op.not]: null,
        // },
      } as any,
    });

    // Get all past working days in current month
    const pastWorkingDays = WorkingDaysUtil.getWorkingDays(
      currentMonth,
      currentYear,
      holidayDates,
    ).filter((day) => {
      const dayDate = new Date(day);
      dayDate.setHours(0, 0, 0, 0);
      return dayDate <= today;
    });

    // Get all attendance records for past working days
    const pastWorkingDayDates = pastWorkingDays.map((day) =>
      day.toISOString().split('T')[0],
    );
    const pastAttendances = await this.attendanceModel.findAll({
      where: {
        employeeId,
        date: {
          [Op.in]: pastWorkingDayDates,
        },
        deletedAt: null,
      },
    });

    // Calculate missing working days (no attendance record or no check-in)
    // Note: att.date is a DATEONLY field which returns as string (YYYY-MM-DD), not Date object
    const attendedDates = pastAttendances
      .filter((att) => att.checkInTime !== null)
      .map((att) => {
        // DATEONLY fields return as string in YYYY-MM-DD format
        if (att.date instanceof Date) {
          return att.date.toISOString().split('T')[0];
        }
        // Already a string in YYYY-MM-DD format
        return String(att.date);
      });
    const missingWorkingDays = pastWorkingDays.filter((day: Date) => {
      const dayStr = day.toISOString().split('T')[0];
      return !attendedDates.includes(dayStr);
    });

    // Calculate short minutes: existing + missing working days (540 minutes each)
    const missingShortMinutes = missingWorkingDays.length * 540; // 9 hours = 540 minutes per missing day
    const totalShortMinutes = (monthlySummary?.totalShortMinutes || 0) + missingShortMinutes;
    const allowedShortMinutes = this.salaryCalculator.getAllowedShortMinutesPerMonth();
    const missingMinutes = Math.max(0, totalShortMinutes - allowedShortMinutes);

    // Calculate working days (Monday to Friday) in current month, excluding public holidays
    const workingDays = WorkingDaysUtil.countWorkingDays(
      currentMonth,
      currentYear,
      holidayDates,
    );

    // Get total salary (all time)
    const allAttendances = await this.attendanceModel.findAll({
      where: {
        employeeId,
        checkOutTime: {
          [Op.not]: null,
        },
      } as any,
    });

    const totalSalary = allAttendances.reduce(
      (sum, att) => sum + parseFloat(att.salaryEarned?.toString() || '0'),
      0,
    );

    // Get current month deductions
    const currentMonthDeductions = await this.deductionLedgerModel.findAll({
      where: {
        employeeId,
        createdAt: {
          [Op.between]: [startDate, endDate],
        },
      } as any,
    });

    const totalDeductions = currentMonthDeductions.reduce(
      (sum, ded) => sum + parseFloat(ded.deductedAmount.toString()),
      0,
    );

    // Get leave requests for current month
    const leaveRequests = await this.leaveRequestModel.findAll({
      where: {
        employeeId,
        date: {
          [Op.between]: [startDate, endDate],
        },
      } as any,
      order: [['date', 'DESC']],
    });

    // Get leave balance for current month
    const leaveBalance = await this.leaveBalanceUtil.getCurrentBalance(
      employeeId,
      currentMonth,
      currentYear,
      employee.joiningDate,
    );

    // Calculate salary details
    const dailySalary = parseFloat(employee.dailySalary.toString());
    const monthlySalary = dailySalary * 22; // Based on 22 working days per month
    const salaryPerHour = monthlySalary / (22 * 9); // 22 days * 9 hours per day
    const salaryEarnedThisMonth = parseFloat(monthlySummary?.totalSalaryEarned?.toString() || '0');
    const leavesInHours = leaveBalance.utilizedMinutes / 60;

    return {
      employee: {
        id: employee.id,
        fullName: employee.fullName,
        designation: employee.designation,
        dailySalary: dailySalary,
        salaryPerHour: parseFloat(salaryPerHour.toFixed(2)),
        monthlySalary: monthlySalary,
        status: employee.status || 'full-time',
        joiningDate: employee.joiningDate,
      },
      currentMonth: {
        month: currentMonth,
        year: currentYear,
        totalWorkedMinutes: monthlySummary?.totalWorkedMinutes || 0,
        totalShortMinutes: totalShortMinutes,
        missingMinutes: missingMinutes,
        allowedShortMinutes: allowedShortMinutes,
        salaryEarnedThisMonth: salaryEarnedThisMonth,
        totalDeductions: totalDeductions,
        netSalary: salaryEarnedThisMonth - totalDeductions,
        workingDays: workingDays,
        daysWorked: currentMonthAttendances.length,
        leavesInHours: parseFloat(leavesInHours.toFixed(2)),
        leaveBalance: {
          totalHours: leaveBalance.balanceMinutes / 60,
          utilizedHours: leaveBalance.utilizedMinutes / 60,
          availableHours: leaveBalance.availableMinutes / 60,
          carryoverHours: leaveBalance.carryoverMinutes / 60,
        },
        leaveRequests: leaveRequests.map((lr) => ({
          id: lr.id,
          date: lr.date,
          hours: lr.hours,
          status: lr.status,
          reason: lr.reason,
        })),
      },
      totalSalary: totalSalary,
    };
  }

  /**
   * Count working days (Monday to Friday) in a month
   */
  private countWorkingDays(month: number, year: number): number {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    let count = 0;

    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      const dayOfWeek = date.getDay();
      // Monday = 1, Friday = 5
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        count++;
      }
    }

    return count;
  }

  /**
   * Ensure attendance records exist for current month's past working days
   * Auto-creates records for missing past working days as unpaid leave
   */
  private async ensureCurrentMonthPastWorkingDays(employeeId?: string): Promise<void> {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const startDate = new Date(currentYear, currentMonth - 1, 1);
    const endDate = new Date(today);

    await this.ensureAttendanceRecordsForDateRange(startDate, endDate, employeeId, true);
  }

  /**
   * Ensure today has an inactive attendance record if it's a working day
   */
  private async ensureTodayInactiveRecord(employeeId: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if today is a working day
    const dayOfWeek = today.getDay();
    if (dayOfWeek < 1 || dayOfWeek > 5) {
      // Not a weekday
      return;
    }

    // Check if it's a public holiday
    const publicHolidays = await this.publicHolidayModel.findAll({
      where: {
        date: today.toISOString().split('T')[0],
      },
    });

    if (publicHolidays.length > 0) {
      // It's a public holiday
      return;
    }

    // Check if record already exists
    const existingAttendance = await this.attendanceModel.findOne({
      where: {
        employeeId,
        date: today.toISOString().split('T')[0],
        deletedAt: null,
      },
    });

    if (!existingAttendance) {
      // Create inactive record for today
      await this.attendanceModel.create({
        employeeId,
        date: today.toISOString().split('T')[0],
        checkInTime: null,
        checkOutTime: null,
        totalWorkedMinutes: null,
        shortMinutes: null,
        salaryEarned: null,
        unpaidLeave: false,
        isPublicHoliday: false,
        isActive: false, // Inactive until check-in
      } as any);
    }
  }

  /**
   * Ensure attendance records exist for past working days in a date range
   * Auto-creates records for missing working days (excluding public holidays)
   * @param markAsUnpaidLeave If true, marks missing days as unpaid leave (for current month auto-creation)
   */
  private async ensureAttendanceRecordsForDateRange(
    startDate: Date,
    endDate: Date,
    employeeId?: string,
    markAsUnpaidLeave: boolean = false,
  ): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Only process past dates
    const processEndDate = endDate < today ? endDate : today;

    // Get all public holidays in the date range
    const publicHolidays = await this.publicHolidayModel.findAll({
      where: {
        date: {
          [Op.between]: [startDate, processEndDate],
        },
      },
    });

    const holidayDates = publicHolidays.map((h) => h.date.toISOString().split('T')[0]);

    // Get employees to process
    const employeeWhere: any = { deletedAt: null };
    if (employeeId) {
      employeeWhere.id = employeeId;
    }

    const employees = await this.employeeModel.findAll({
      where: employeeWhere,
      include: [
        {
          model: User,
          as: 'user',
          where: { deletedAt: null, isActive: true },
          required: true,
        },
      ],
    });

    // Process each day in the range
    for (let date = new Date(startDate); date <= processEndDate; date.setDate(date.getDate() + 1)) {
      const dayOfWeek = date.getDay();
      const dateStr = date.toISOString().split('T')[0];

      // Skip weekends
      if (dayOfWeek < 1 || dayOfWeek > 5) {
        continue;
      }

      // Check if it's a public holiday
      const isPublicHoliday = holidayDates.includes(dateStr);

      // Skip if it's a public holiday (public holidays are handled separately when created)
      if (isPublicHoliday) {
        continue;
      }

      // For each employee, check if attendance record exists
      for (const employee of employees) {
        const existingAttendance = await this.attendanceModel.findOne({
          where: {
            employeeId: employee.id,
            date: dateStr,
            deletedAt: null,
          },
        });

        // If no attendance record exists, create one
        if (!existingAttendance) {
          // If markAsUnpaidLeave is true, create as unpaid leave (for current month auto-creation)
          if (markAsUnpaidLeave) {
            await this.attendanceModel.create({
              employeeId: employee.id,
              date: dateStr,
              checkInTime: null,
              checkOutTime: null,
              totalWorkedMinutes: 0,
              shortMinutes: 540, // Full day = 540 minutes (9 hours)
              salaryEarned: 0,
              unpaidLeave: true, // Mark as unpaid leave (not requested, just auto-created)
              isPublicHoliday: false,
            } as any);
          } else {
            // For date range queries, create empty record
            await this.attendanceModel.create({
              employeeId: employee.id,
              date: dateStr,
              checkInTime: null,
              checkOutTime: null,
              totalWorkedMinutes: null,
              shortMinutes: null,
              salaryEarned: null,
              unpaidLeave: false,
              isPublicHoliday: false,
            } as any);
          }
        }
      }
    }
  }

  /**
   * Request leave for a specific day
   */
  async requestLeave(
    employeeId: string,
    date: Date,
    hours: number,
    reason?: string,
  ): Promise<any> {
    // Validate employee exists
    const employee = await this.employeeModel.findByPk(employeeId);
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    // Validate hours (1-9)
    if (hours < 1 || hours > 9) {
      throw new BadRequestException('Hours must be between 1 and 9');
    }

    // Validate date is today or future
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const leaveDate = new Date(date);
    leaveDate.setHours(0, 0, 0, 0);

    if (leaveDate < today) {
      throw new BadRequestException('Leave can only be requested for today or future dates');
    }

    // Check if leave already exists for this date
    const existingLeave = await this.leaveRequestModel.findOne({
      where: {
        employeeId,
        date: leaveDate,
      },
    });

    if (existingLeave) {
      throw new BadRequestException('Leave request already exists for this date');
    }

    // Check if attendance already exists for this date
    const existingAttendance = await this.attendanceModel.findOne({
      where: {
        employeeId,
        date: leaveDate,
      },
    });

    if (existingAttendance) {
      throw new BadRequestException('Attendance already exists for this date. Cannot request leave.');
    }

    // Determine the month and year for the leave request
    const leaveMonth = leaveDate.getMonth() + 1;
    const leaveYear = leaveDate.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    const isNextMonth = leaveYear > currentYear || (leaveYear === currentYear && leaveMonth > currentMonth);

    // Get leave balance for the target month (next month gets fresh balance)
    const targetBalance = await this.leaveBalanceUtil.getCurrentBalance(
      employeeId,
      leaveMonth,
      leaveYear,
      employee.joiningDate,
    );

    // Get all leave requests for the target month (pending and approved)
    const monthStart = new Date(leaveYear, leaveMonth - 1, 1);
    const monthEnd = new Date(leaveYear, leaveMonth, 0);
    const monthLeaveRequests = await this.leaveRequestModel.findAll({
      where: {
        employeeId,
        date: {
          [Op.between]: [monthStart, monthEnd],
        },
        status: {
          [Op.in]: ['pending', 'approved'],
        },
      },
    });

    // Calculate total hours already requested/approved for this month
    const pendingRequests = monthLeaveRequests.filter((lr) => lr.status === 'pending');
    const approvedRequests = monthLeaveRequests.filter((lr) => lr.status === 'approved');

    const totalPendingHours = pendingRequests.reduce((sum, lr) => sum + lr.hours, 0);
    const totalApprovedHours = approvedRequests.reduce((sum, lr) => sum + lr.hours, 0);
    const totalApprovedPaidHours = approvedRequests.reduce(
      (sum, lr) => sum + (lr.hours - (lr.unpaidHours || 0)),
      0,
    );
    const totalApprovedUnpaidHours = approvedRequests.reduce(
      (sum, lr) => sum + (lr.unpaidHours || 0),
      0,
    );

    // Calculate available balance
    // Note: availableBalanceHours already accounts for utilized minutes from approved requests
    const availableBalanceHours = targetBalance.availableMinutes / 60;

    // Calculate for current request
    const requestedHours = hours;
    const totalPendingWithCurrent = totalPendingHours + requestedHours;
    const totalRequestedHours = totalPendingWithCurrent + totalApprovedHours;

    // Calculate paid vs unpaid for current request
    // This is based on remaining balance after approved requests (which is already in availableBalanceHours)
    let paidHoursForCurrent = 0;
    let unpaidHoursForCurrent = 0;

    if (availableBalanceHours >= requestedHours) {
      // Sufficient balance for current request
      paidHoursForCurrent = requestedHours;
      unpaidHoursForCurrent = 0;
    } else {
      // Insufficient balance
      paidHoursForCurrent = Math.max(0, availableBalanceHours);
      unpaidHoursForCurrent = requestedHours - paidHoursForCurrent;
    }

    // Build detailed message
    let message = 'Leave request submitted successfully. ';

    if (isNextMonth) {
      message += `This is for next month (${leaveMonth}/${leaveYear}), which will be calculated as a fresh month. `;
    }

    // Scenario 1: Single request with sufficient balance
    if (pendingRequests.length === 0 && approvedRequests.length === 0) {
      if (paidHoursForCurrent === requestedHours) {
        message += `${requestedHours} hours will be deducted from your ${availableBalanceHours.toFixed(1)} hours leave balance.`;
      } else {
        message += `${paidHoursForCurrent.toFixed(1)} hours will be deducted from your ${availableBalanceHours.toFixed(1)} hours leave balance, and ${unpaidHoursForCurrent.toFixed(1)} hours will be marked as unpaid leave.`;
      }
    }
    // Scenario 2: Has pending requests (not yet approved)
    else if (pendingRequests.length > 0 && approvedRequests.length === 0) {
      const totalPendingHoursWithCurrent = totalPendingHours + requestedHours;
      message += `You have ${totalPendingHoursWithCurrent} hours of leave requests pending for this month. `;
      
      if (availableBalanceHours >= totalPendingHoursWithCurrent) {
        message += `If all requests are approved, ${totalPendingHoursWithCurrent} hours will be deducted from your ${availableBalanceHours.toFixed(1)} hours leave balance.`;
      } else {
        const totalPaid = availableBalanceHours;
        const totalUnpaid = totalPendingHoursWithCurrent - availableBalanceHours;
        message += `If all requests are approved, ${totalPaid.toFixed(1)} hours will be deducted from your ${availableBalanceHours.toFixed(1)} hours leave balance, and ${totalUnpaid.toFixed(1)} hours will be marked as unpaid leave.`;
      }
    }
    // Scenario 3: Has approved requests
    else if (approvedRequests.length > 0) {
      // availableBalanceHours already reflects remaining balance after approved requests
      const remainingBalance = availableBalanceHours;
      message += `You have ${totalApprovedHours} hours of approved leave (${totalApprovedPaidHours.toFixed(1)} hours paid, ${totalApprovedUnpaidHours.toFixed(1)} hours unpaid). `;
      
      if (pendingRequests.length === 0) {
        // Only approved, adding new request
        if (paidHoursForCurrent === requestedHours) {
          message += `This request will deduct ${requestedHours} hours from your remaining ${remainingBalance.toFixed(1)} hours leave balance.`;
        } else {
          message += `This request will deduct ${paidHoursForCurrent.toFixed(1)} hours from your remaining ${remainingBalance.toFixed(1)} hours leave balance, and ${unpaidHoursForCurrent.toFixed(1)} hours will be marked as unpaid leave.`;
        }
      } else {
        // Has both approved and pending
        const totalPendingWithCurrent = totalPendingHours + requestedHours;
        const totalAfterAll = totalApprovedHours + totalPendingWithCurrent;
        const totalPaidAfterAll = totalApprovedPaidHours + Math.min(remainingBalance, totalPendingWithCurrent);
        const totalUnpaidAfterAll = totalApprovedUnpaidHours + Math.max(0, totalPendingWithCurrent - remainingBalance);
        
        message += `You have ${totalPendingWithCurrent} hours of pending requests. `;
        message += `If all pending requests are approved, you will have ${totalPaidAfterAll.toFixed(1)} hours of paid leave and ${totalUnpaidAfterAll.toFixed(1)} hours of unpaid leave for this month.`;
      }
    }

    // Create leave request
    const leaveRequest = await this.leaveRequestModel.create({
      employeeId,
      date: leaveDate,
      hours,
      status: 'pending',
      reason: reason || null,
    } as any);

    return {
      id: leaveRequest.id,
      employeeId: leaveRequest.employeeId,
      date: leaveRequest.date,
      hours: leaveRequest.hours,
      status: leaveRequest.status,
      reason: leaveRequest.reason,
      message,
      breakdown: {
        availableBalance: availableBalanceHours,
        requestedHours: requestedHours,
        paidHours: paidHoursForCurrent,
        unpaidHours: unpaidHoursForCurrent,
        pendingRequestsCount: pendingRequests.length + 1, // Including current
        approvedRequestsCount: approvedRequests.length,
        totalPendingHours: totalPendingWithCurrent,
        totalApprovedHours: totalApprovedHours,
        isNextMonth: isNextMonth,
      },
    };
  }

  /**
   * Get user's leave requests
   */
  async getMyLeaveRequests(employeeId: string, month?: number, year?: number): Promise<any[]> {
    const whereClause: any = { employeeId };

    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      whereClause.date = {
        [Op.between]: [startDate, endDate],
      };
    }

    const leaveRequests = await this.leaveRequestModel.findAll({
      where: whereClause,
      order: [['date', 'DESC']],
    });

    return leaveRequests.map((lr) => ({
      id: lr.id,
      date: lr.date,
      hours: lr.hours,
      unpaidHours: lr.unpaidHours || 0,
      status: lr.status,
      reason: lr.reason,
      createdAt: lr.createdAt,
    }));
  }
}
