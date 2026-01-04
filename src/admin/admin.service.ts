import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { User } from '../database/models/user.model';
import { Employee } from '../database/models/employee.model';
import { Attendance } from '../database/models/attendance.model';
import { MonthlyAttendanceSummary } from '../database/models/monthly-attendance-summary.model';
import { SalaryDeductionLedger } from '../database/models/salary-deduction-ledger.model';
import { EmployeesService } from '../employees/employees.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UserRole } from '../common/enums/user-role.enum';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User)
    private userModel: typeof User,
    @InjectModel(Employee)
    private employeeModel: typeof Employee,
    @InjectModel(Attendance)
    private attendanceModel: typeof Attendance,
    @InjectModel(MonthlyAttendanceSummary)
    private monthlySummaryModel: typeof MonthlyAttendanceSummary,
    @InjectModel(SalaryDeductionLedger)
    private deductionLedgerModel: typeof SalaryDeductionLedger,
    private employeesService: EmployeesService,
  ) {}

  async createUser(createUserDto: CreateUserDto) {
    if (createUserDto.role === UserRole.EMPLOYEE) {
      // If creating employee, use employees service
      if (
        !createUserDto.fullName ||
        !createUserDto.phone ||
        !createUserDto.designation ||
        !createUserDto.dailySalary ||
        !createUserDto.joiningDate
      ) {
        throw new BadRequestException(
          'Employee requires: fullName, phone, designation, dailySalary, joiningDate',
        );
      }

      return this.employeesService.create({
        email: createUserDto.email,
        password: createUserDto.password,
        role: createUserDto.role,
        fullName: createUserDto.fullName,
        phone: createUserDto.phone,
        designation: createUserDto.designation,
        dailySalary: createUserDto.dailySalary,
        joiningDate: createUserDto.joiningDate,
      });
    } else {
      // Create admin user (simplified - just user, no employee record)
      const existingUser = await this.userModel.findOne({
        where: { email: createUserDto.email },
      });

      if (existingUser) {
        throw new BadRequestException('User with this email already exists');
      }

      // This would need password hashing - for now, we'll use employees service pattern
      // But for admin, we might want a simpler approach
      throw new BadRequestException(
        'Admin user creation not fully implemented - use employee creation for now',
      );
    }
  }

  async getMonthlySalaryReport(month: number, year: number) {
    const summaries = await this.monthlySummaryModel.findAll({
      where: {
        month,
        year,
      },
      include: [
        {
          model: Employee,
          attributes: ['id', 'fullName', 'designation', 'dailySalary'],
          include: [
            {
              model: Employee.associations.user.target,
              as: 'user',
              attributes: ['id', 'email'],
            },
          ],
        },
      ],
      order: [[Employee, 'fullName', 'ASC']],
    });

    return summaries.map((summary) => ({
      employeeId: summary.employeeId,
      employeeName: summary.employee?.fullName || 'N/A',
      employeeEmail: summary.employee?.user?.email || 'N/A',
      designation: summary.employee?.designation || 'N/A',
      month,
      year,
      totalWorkedMinutes: summary.totalWorkedMinutes,
      totalWorkedHours: (summary.totalWorkedMinutes / 60).toFixed(2),
      totalShortMinutes: summary.totalShortMinutes,
      totalShortHours: (summary.totalShortMinutes / 60).toFixed(2),
      totalSalaryEarned: parseFloat(summary.totalSalaryEarned.toString()),
      dailySalary: parseFloat(summary.employee?.dailySalary?.toString() || '0'),
    }));
  }

  async getEmployeeSalaryReport(employeeId: string, month?: number, year?: number) {
    const employee = await this.employeeModel.findByPk(employeeId, {
      include: [
        {
          model: User,
          attributes: ['id', 'email'],
        },
      ],
    });

    if (!employee) {
      throw new BadRequestException('Employee not found');
    }

    const whereClause: any = { employeeId };

    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      whereClause.date = {
        [Op.between]: [startDate, endDate],
      };
    }

    const attendances = await this.attendanceModel.findAll({
      where: whereClause,
      order: [['date', 'DESC']],
    });

    const deductions = await this.deductionLedgerModel.findAll({
      where: {
        employeeId,
        ...(month && year
          ? {
              createdAt: {
                [Op.between]: [
                  new Date(year, month - 1, 1),
                  new Date(year, month, 0, 23, 59, 59),
                ],
              },
            }
          : {}),
      },
      include: [
        {
          model: Attendance,
          attributes: ['id', 'date'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    const totalSalary = attendances.reduce(
      (sum, att) => sum + parseFloat(att.salaryEarned?.toString() || '0'),
      0,
    );

    const totalDeductions = deductions.reduce(
      (sum, ded) => sum + parseFloat(ded.deductedAmount.toString()),
      0,
    );

    return {
      employee: {
        id: employee.id,
        fullName: employee.fullName,
        email: employee.user?.email,
        designation: employee.designation,
        dailySalary: parseFloat(employee.dailySalary.toString()),
      },
      period: month && year ? { month, year } : 'all',
      totalDays: attendances.length,
      totalSalary,
      totalDeductions,
      netSalary: totalSalary - totalDeductions,
      attendances: attendances.map((att) => ({
        id: att.id,
        date: att.date,
        checkInTime: att.checkInTime,
        checkOutTime: att.checkOutTime,
        totalWorkedMinutes: att.totalWorkedMinutes,
        shortMinutes: att.shortMinutes,
        salaryEarned: parseFloat(att.salaryEarned?.toString() || '0'),
      })),
      deductions: deductions.map((ded) => ({
        id: ded.id,
        date: ded.attendance?.date,
        deductedMinutes: ded.deductedMinutes,
        deductedAmount: parseFloat(ded.deductedAmount.toString()),
        reason: ded.reason,
        createdAt: ded.createdAt,
      })),
    };
  }
}

