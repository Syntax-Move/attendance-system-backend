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
import { SalaryCalculator } from '../common/utils/salary-calculator.util';
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
    private sequelize: Sequelize,
  ) {}

  async checkIn(
    employeeId: string,
    checkInDto: CheckInDto,
  ): Promise<CheckInResponseDto> {
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
    const existingAttendance = (
      await this.attendanceModel.findOne({
        where: {
          employeeId,
          date: today,
        },
      })
    )?.get({ plain: true });

    if (existingAttendance) {
      throw new BadRequestException('Already checked in today');
    }

    // Create check-in record
    const attendance = await this.attendanceModel.create({
      employeeId,
      date: today,
      checkInTime: checkInDateTime,
    } as any);

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

      // Calculate salary
      const calculation = SalaryCalculator.calculateSalary(
        checkInTime,
        checkOutTime,
        parseFloat(employee.dailySalary.toString()),
        monthlyShortMinutes,
      );

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
    const whereClause: any = { employeeId };

    if (query.startDate && query.endDate) {
      whereClause.date = {
        [Op.between]: [new Date(query.startDate), new Date(query.endDate)],
      };
    } else if (query.month && query.year) {
      const startDate = new Date(query.year, query.month - 1, 1);
      const endDate = new Date(query.year, query.month, 0);
      whereClause.date = {
        [Op.between]: [startDate, endDate],
      };
    }

    const attendances = await this.attendanceModel.findAll({
      where: whereClause,
      include: [
        {
          model: Employee,
          attributes: ['id', 'fullName', 'designation'],
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
    const whereClause: any = {};

    if (query.employeeId) {
      whereClause.employeeId = query.employeeId;
    }

    if (query.startDate && query.endDate) {
      whereClause.date = {
        [Op.between]: [new Date(query.startDate), new Date(query.endDate)],
      };
    }

    const attendances = await this.attendanceModel.findAll({
      where: whereClause,
      include: [
        {
          model: Employee,
          attributes: ['id', 'fullName', 'designation', 'phone'],
          include: [
            {
              model: Employee.associations.user.target,
              as: 'user',
              attributes: ['id', 'email'],
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
    const attendance = await this.attendanceModel.findByPk(id);

    if (!attendance) {
      throw new NotFoundException('Attendance record not found');
    }

    const transaction = await this.sequelize.transaction();

    try {
      const employeeId = attendance.employeeId;
      const attendanceDate = new Date(attendance.date);
      const month = attendanceDate.getMonth() + 1;
      const year = attendanceDate.getFullYear();

      // Delete the attendance (cascade will handle related records)
      await attendance.destroy({ transaction });

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
}
