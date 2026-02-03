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
import { AttendanceRulesUtil } from '../common/utils/attendance-rules.util';
import { WorkingDaysUtil } from '../common/utils/working-days.util';
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
    private attendanceRules: AttendanceRulesUtil,
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

    const isLate = this.attendanceRules.isLate(checkInDateTime, today);
    const isHalfDay = this.attendanceRules.isHalfDay(checkInDateTime, today);

    let attendance;
    if (existingAttendance) {
      // If record exists but is inactive, activate it and add check-in
      if (!existingAttendance.isActive) {
        await existingAttendance.update({
          isActive: true,
          checkInTime: checkInDateTime,
          isLate,
          isHalfDay,
        });
        attendance = existingAttendance;
      } else if (existingAttendance.checkInTime) {
        throw new BadRequestException('Already checked in today');
      } else {
        await existingAttendance.update({
          checkInTime: checkInDateTime,
          isLate,
          isHalfDay,
        });
        attendance = existingAttendance;
      }
    } else {
      attendance = await this.attendanceModel.create({
        employeeId,
        date: today,
        checkInTime: checkInDateTime,
        isActive: true,
        isLate,
        isHalfDay,
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

      const attendanceDate = new Date(attendance.date);
      const isHalfDay = (attendance as any).isHalfDay ?? this.attendanceRules.isHalfDay(checkInTime, attendanceDate);

      // Calculate salary using working window [m, m+9h] and half-day rule
      const calculation = this.salaryCalculator.calculateSalary(
        checkInTime,
        checkOutTime,
        attendanceDate,
        isHalfDay,
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

  /**
   * Admin: Create attendance for any employee and date with any check-in/check-out times.
   */
  async createAttendanceByAdmin(
    employeeId: string,
    date: string,
    checkInTime: Date,
    checkOutTime: Date,
  ): Promise<any> {
    const employee = await this.employeeModel.findByPk(employeeId);
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
    if (checkOutTime <= checkInTime) {
      throw new BadRequestException('Check-out time must be after check-in time');
    }
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);

    const existing = await this.attendanceModel.findOne({
      where: { employeeId, date: dateOnly, deletedAt: null },
    });
    if (existing) {
      throw new BadRequestException('Attendance already exists for this employee and date. Use update instead.');
    }

    const isLate = this.attendanceRules.isLate(checkInTime, dateOnly);
    const isHalfDay = this.attendanceRules.isHalfDay(checkInTime, dateOnly);

    const transaction = await this.sequelize.transaction();
    try {
      const attendance = await this.attendanceModel.create(
        {
          employeeId,
          date: dateOnly,
          checkInTime,
          checkOutTime,
          isActive: true,
          isLate,
          isHalfDay,
        } as any,
        { transaction },
      );

      const month = dateOnly.getMonth() + 1;
      const year = dateOnly.getFullYear();
      const monthlyShortMinutes = await this.getMonthlyShortMinutes(
        employeeId,
        month,
        year,
        attendance.id,
        transaction,
      );
      const leaveBalance = await this.leaveBalanceUtil.getCurrentBalance(
        employeeId,
        month,
        year,
        employee.joiningDate,
      );
      const calculation = this.salaryCalculator.calculateSalary(
        checkInTime,
        checkOutTime,
        dateOnly,
        isHalfDay,
        parseFloat(employee.dailySalary.toString()),
        monthlyShortMinutes,
        leaveBalance.availableMinutes,
      );

      if (calculation.shortMinutes > 0 && leaveBalance.availableMinutes > 0) {
        const minutesToUtilize = Math.min(calculation.shortMinutes, leaveBalance.availableMinutes);
        await this.leaveBalanceUtil.utilizeLeave(employeeId, month, year, minutesToUtilize);
      }

      await attendance.update(
        {
          totalWorkedMinutes: calculation.totalWorkedMinutes,
          shortMinutes: calculation.shortMinutes,
          salaryEarned: calculation.salaryEarned,
        },
        { transaction },
      );

      if (calculation.deductionMinutes > 0) {
        await this.deductionLedgerModel.create(
          {
            employeeId,
            attendanceId: attendance.id,
            deductedMinutes: calculation.deductionMinutes,
            deductedAmount: calculation.deductedAmount,
            reason: `Short hours deduction for ${date}`,
          } as any,
          { transaction },
        );
      }

      await this.updateMonthlySummary(employeeId, month, year, calculation, transaction);
      await transaction.commit();

      const saved = await this.attendanceModel.findByPk(attendance.id, {
        include: [{ model: Employee, attributes: ['id', 'fullName', 'designation'] }],
      });
      return saved?.get({ plain: true });
    } catch (e) {
      await transaction.rollback();
      throw e;
    }
  }

  /**
   * Admin: Update check-in/check-out of any attendance. Recomputes late, half-day, and salary.
   */
  async updateAttendanceByAdmin(
    id: string,
    body: { checkInTime?: Date; checkOutTime?: Date },
  ): Promise<any> {
    const attendance = await this.attendanceModel.findOne({
      where: { id, deletedAt: null },
      include: [{ model: Employee }],
    });
    if (!attendance) {
      throw new NotFoundException('Attendance record not found');
    }

    const checkInTime = body.checkInTime ?? attendance.checkInTime;
    const checkOutTime = body.checkOutTime ?? attendance.checkOutTime;
    if (!checkInTime || !checkOutTime) {
      throw new BadRequestException('Both check-in and check-out are required to recalculate salary.');
    }
    if (checkOutTime <= checkInTime) {
      throw new BadRequestException('Check-out time must be after check-in time');
    }

    const dateOnly = new Date(attendance.date);
    dateOnly.setHours(0, 0, 0, 0);
    const isLate = this.attendanceRules.isLate(checkInTime, dateOnly);
    const isHalfDay = this.attendanceRules.isHalfDay(checkInTime, dateOnly);
    const employeeId = attendance.employeeId;
    const employee = attendance.get('employee') as Employee;
    const month = dateOnly.getMonth() + 1;
    const year = dateOnly.getFullYear();
    console.log({employee, employeeId});
    if(!employee) {
      throw new NotFoundException('Employee not found');
    }
    const transaction = await this.sequelize.transaction();
    try {
      const monthlyShortMinutes = await this.getMonthlyShortMinutes(
        employeeId,
        month,
        year,
        attendance.id,
        transaction,
      );
      const leaveBalance = await this.leaveBalanceUtil.getCurrentBalance(
        employeeId,
        month,
        year,
        employee?.joiningDate,
      );
      const calculation = this.salaryCalculator.calculateSalary(
        checkInTime,
        checkOutTime,
        dateOnly,
        isHalfDay,
        parseFloat(employee?.dailySalary?.toString()),
        monthlyShortMinutes,
        leaveBalance.availableMinutes,
      );

      await this.deductionLedgerModel.destroy({
        where: { attendanceId: attendance.id },
        transaction,
      });
      if (calculation.deductionMinutes > 0) {
        await this.deductionLedgerModel.create(
          {
            employeeId,
            attendanceId: attendance.id,
            deductedMinutes: calculation.deductionMinutes,
            deductedAmount: calculation.deductedAmount,
            reason: `Short hours deduction for ${attendance.date}`,
          } as any,
          { transaction },
        );
      }

      await attendance.update(
        {
          checkInTime,
          checkOutTime,
          isLate,
          isHalfDay,
          totalWorkedMinutes: calculation.totalWorkedMinutes,
          shortMinutes: calculation.shortMinutes,
          salaryEarned: calculation.salaryEarned,
        },
        { transaction },
      );

      await this.recalculateMonthlySummary(employeeId, month, year, transaction);
      await transaction.commit();

      const updated = await this.attendanceModel.findByPk(id, {
        include: [{ model: Employee, attributes: ['id', 'fullName', 'designation'] }],
      });
      return updated?.get({ plain: true });
    } catch (e) {
      await transaction.rollback();
      throw e;
    }
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
        leaveRequests: leaveRequests.map((lr) => {
          const days = lr.days != null ? parseFloat(lr.days.toString()) : (lr.hours || 0) / 9;
          return {
            id: lr.id,
            date: lr.date,
            days,
            hours: Math.round(days * 9),
            unpaidDays: lr.unpaidDays != null ? parseFloat(lr.unpaidDays.toString()) : 0,
            status: lr.status,
            reason: lr.reason,
          };
        }),
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

  /** Leave in multiples of 0.5 day; 1 day = 9 hours = 540 minutes */
  private static readonly MINUTES_PER_LEAVE_DAY = 9 * 60;

  /**
   * Request leave for a specific day. Leave is in days: 0.5, 1, 1.5, 2, ...
   * Also accepts legacy hours (converted to days = hours/9).
   */
  async requestLeave(
    employeeId: string,
    date: Date,
    daysOrHours: number,
    reason?: string,
    useDays: boolean = true,
  ): Promise<any> {
    const employee = await this.employeeModel.findByPk(employeeId);
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const days = useDays
      ? daysOrHours
      : Math.round((daysOrHours / 9) * 100) / 100;
    if (days <= 0 || days > 31) {
      throw new BadRequestException('Leave must be between 0.5 and 31 days');
    }
    if (!Number.isInteger(days * 2) || days < 0.5) {
      throw new BadRequestException('Leave must be in multiples of 0.5 day (e.g. 0.5, 1, 1.5, 2)');
    }
    const requestedMinutes = Math.round(days * AttendanceService.MINUTES_PER_LEAVE_DAY);

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

    const pendingRequests = monthLeaveRequests.filter((lr) => lr.status === 'pending');
    const approvedRequests = monthLeaveRequests.filter((lr) => lr.status === 'approved');

    const getMinutes = (lr: any) => {
      const d = lr.days != null ? parseFloat(lr.days) : (lr.hours || 0) / 9;
      return Math.round(d * AttendanceService.MINUTES_PER_LEAVE_DAY);
    };
    const totalPendingMinutes = pendingRequests.reduce((sum, lr) => sum + getMinutes(lr), 0);
    const totalApprovedMinutes = approvedRequests.reduce((sum, lr) => sum + getMinutes(lr), 0);
    const availableBalanceMinutes = targetBalance.availableMinutes;

    let paidMinutesForCurrent = 0;
    let unpaidMinutesForCurrent = 0;
    if (availableBalanceMinutes >= requestedMinutes) {
      paidMinutesForCurrent = requestedMinutes;
      unpaidMinutesForCurrent = 0;
    } else {
      paidMinutesForCurrent = Math.max(0, availableBalanceMinutes);
      unpaidMinutesForCurrent = requestedMinutes - paidMinutesForCurrent;
    }
    const unpaidDaysForCurrent = Math.round((unpaidMinutesForCurrent / AttendanceService.MINUTES_PER_LEAVE_DAY) * 100) / 100;
    const availableBalanceDays = availableBalanceMinutes / AttendanceService.MINUTES_PER_LEAVE_DAY;

    let message = 'Leave request submitted successfully. ';
    if (isNextMonth) {
      message += `This is for next month (${leaveMonth}/${leaveYear}), which will be calculated as a fresh month. `;
    }
    if (unpaidDaysForCurrent > 0) {
      message += `${days} day(s) requested; ${paidMinutesForCurrent / AttendanceService.MINUTES_PER_LEAVE_DAY} day(s) from balance, ${unpaidDaysForCurrent} day(s) will be deducted from salary if approved.`;
    } else {
      message += `${days} day(s) will be deducted from your ${availableBalanceDays.toFixed(1)} days leave balance if approved.`;
    }

    const leaveRequest = await this.leaveRequestModel.create({
      employeeId,
      date: leaveDate,
      hours: Math.round(days * 9),
      days,
      status: 'pending',
      reason: reason || null,
    } as any);

    return {
      id: leaveRequest.id,
      employeeId: leaveRequest.employeeId,
      date: leaveRequest.date,
      days,
      hours: Math.round(days * 9),
      status: leaveRequest.status,
      reason: leaveRequest.reason,
      message,
      breakdown: {
        availableBalanceDays,
        requestedDays: days,
        paidDays: paidMinutesForCurrent / AttendanceService.MINUTES_PER_LEAVE_DAY,
        unpaidDays: unpaidDaysForCurrent,
        isNextMonth,
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

    return leaveRequests.map((lr) => {
      const days = lr.days != null ? parseFloat(lr.days.toString()) : (lr.hours || 0) / 9;
      const unpaidDays = lr.unpaidDays != null ? parseFloat(lr.unpaidDays.toString()) : (lr.unpaidHours || 0) / 9;
      return {
        id: lr.id,
        date: lr.date,
        days,
        hours: Math.round(days * 9),
        unpaidDays,
        unpaidHours: Math.round(unpaidDays * 9),
        status: lr.status,
        reason: lr.reason,
        createdAt: lr.createdAt,
      };
    });
  }
}
