import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Op } from 'sequelize';
import { User } from '../database/models/user.model';
import { Employee } from '../database/models/employee.model';
import { Attendance } from '../database/models/attendance.model';
import { MonthlyAttendanceSummary } from '../database/models/monthly-attendance-summary.model';
import { SalaryDeductionLedger } from '../database/models/salary-deduction-ledger.model';
import { LeaveRequest, LeaveStatus } from '../database/models/leave-request.model';
import { PublicHoliday } from '../database/models/public-holiday.model';
import { EmployeesService } from '../employees/employees.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UserRole } from '../common/enums/user-role.enum';
import { LeaveBalanceUtil } from '../common/utils/leave-balance.util';

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
    @InjectModel(LeaveRequest)
    private leaveRequestModel: typeof LeaveRequest,
    @InjectModel(PublicHoliday)
    private publicHolidayModel: typeof PublicHoliday,
    private sequelize: Sequelize,
    private employeesService: EmployeesService,
    private leaveBalanceUtil: LeaveBalanceUtil,
  ) {}

  async createUser(createUserDto: CreateUserDto) {
    if (createUserDto.role === UserRole.EMPLOYEE) {
      // If creating employee, use employees service
      if (
        !createUserDto.fullName ||
        !createUserDto.phone ||
        !createUserDto.designation ||
        (!createUserDto.monthlySalary && !createUserDto.dailySalary) ||
        !createUserDto.joiningDate
      ) {
        throw new BadRequestException(
          'Employee requires: fullName, phone, designation, monthlySalary (or dailySalary), joiningDate',
        );
      }

      // Calculate monthlySalary from dailySalary if monthlySalary not provided
      const monthlySalary = createUserDto.monthlySalary || (createUserDto.dailySalary ? createUserDto.dailySalary * 22 : undefined);
      
      if (!monthlySalary) {
        throw new BadRequestException('Either monthlySalary or dailySalary must be provided');
      }

      return this.employeesService.create({
        email: createUserDto.email,
        password: createUserDto.password,
        role: createUserDto.role,
        fullName: createUserDto.fullName,
        phone: createUserDto.phone,
        designation: createUserDto.designation,
        monthlySalary: monthlySalary,
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

  async getAllLeaveRequests(employeeId?: string, status?: string) {
    const whereClause: any = {};

    if (employeeId) {
      whereClause.employeeId = employeeId;
    }

    if (status) {
      whereClause.status = status;
    }

    const leaveRequests = await this.leaveRequestModel.findAll({
      where: whereClause,
      include: [
        {
          model: Employee,
          attributes: ['id', 'fullName', 'designation', 'joiningDate'],
          required: true, // Employee must exist for leave request
          include: [
            {
              model: Employee.associations.user.target,
              as: 'user', // Use the alias defined in Employee model
              attributes: ['id', 'email'],
              where: {
                deletedAt: null, // Exclude deleted users
              },
              required: true, // User must exist for employee
            },
          ],
        },
      ],
      order: [['date', 'DESC']],
    });

    // Get leave balance for each request to show available balance
    const leaveRequestsWithBalance = await Promise.all(
      leaveRequests.map(async (lr) => {
        // Convert to plain object to ensure proper serialization
        const lrPlain = lr.get({ plain: true });
        const leaveDate = new Date(lrPlain.date);
        const month = leaveDate.getMonth() + 1;
        const year = leaveDate.getFullYear();
        
        let availableBalance = 0;
        try {
          const balance = await this.leaveBalanceUtil.getCurrentBalance(
            lrPlain.employeeId,
            month,
            year,
            lrPlain.employee?.joiningDate ? new Date(lrPlain.employee.joiningDate) : undefined,
          );
          availableBalance = balance.availableMinutes / 60; // Convert to hours
        } catch (error) {
          // If balance doesn't exist yet, it will be 0
          availableBalance = 0;
        }

        // Calculate unpaid hours if request is pending and balance is insufficient
        const requestedHours = lrPlain.hours;
        const unpaidHours = lrPlain.status === 'pending' && availableBalance < requestedHours
          ? Math.ceil((requestedHours * 60 - availableBalance * 60) / 60)
          : (lrPlain.unpaidHours || 0);

        return {
          id: lrPlain.id,
          employeeId: lrPlain.employeeId,
          employee: lrPlain.employee
            ? {
                id: lrPlain.employee.id,
                fullName: lrPlain.employee.fullName || 'N/A',
                email: lrPlain.employee.user?.email || 'N/A',
                designation: lrPlain.employee.designation || 'N/A',
              }
            : {
                id: 'N/A',
                fullName: 'Employee Not Found',
                email: 'N/A',
                designation: 'N/A',
              },
          date: lrPlain.date,
          hours: lrPlain.hours,
          availableBalance: parseFloat(availableBalance.toFixed(1)),
          unpaidHours: unpaidHours,
          status: lrPlain.status,
          reason: lrPlain.reason,
          createdAt: lrPlain.createdAt,
          updatedAt: lrPlain.updatedAt,
        };
      }),
    );

    return leaveRequestsWithBalance;
  }

  async approveLeaveRequest(id: string) {
    const leaveRequest = await this.leaveRequestModel.findByPk(id, {
      include: [
        {
          model: Employee,
        },
      ],
    });

    if (!leaveRequest) {
      throw new NotFoundException('Leave request not found');
    }

    if (leaveRequest.status !== LeaveStatus.PENDING) {
      throw new BadRequestException('Leave request has already been processed');
    }

    const leaveDate = new Date(leaveRequest.date);
    const month = leaveDate.getMonth() + 1;
    const year = leaveDate.getFullYear();
    const leaveMinutes = leaveRequest.hours * 60;

    // Check if this is for next month
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    const isNextMonth = year > currentYear || (year === currentYear && month > currentMonth);

    const transaction = await this.sequelize.transaction();

    try {
      // Check available leave balance for the target month
      // Next month gets fresh balance (15 hours = 900 minutes)
      const balance = await this.leaveBalanceUtil.getCurrentBalance(
        leaveRequest.employeeId,
        month,
        year,
        leaveRequest.employee?.joiningDate,
      );

      // Get all approved leave requests for this month to calculate remaining balance
      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 0);
      const approvedRequests = await this.leaveRequestModel.findAll({
        where: {
          employeeId: leaveRequest.employeeId,
          date: {
            [Op.between]: [monthStart, monthEnd],
          },
          status: LeaveStatus.APPROVED,
          id: {
            [Op.ne]: leaveRequest.id, // Exclude current request
          },
        },
        transaction,
      });

      // Calculate already used paid hours from approved requests
      // Note: balance.availableMinutes already accounts for utilized minutes from the database
      // But we need to check if there are approved requests that haven't been utilized yet
      // (This shouldn't happen in normal flow, but we calculate based on what's in the balance)
      const remainingBalanceMinutes = balance.availableMinutes;

      let paidMinutes = 0;
      let unpaidMinutes = 0;
      let unpaidHours = 0;

      // Calculate paid vs unpaid leave based on remaining balance
      if (remainingBalanceMinutes >= leaveMinutes) {
        // Sufficient balance - use all from leave
        paidMinutes = leaveMinutes;
        unpaidMinutes = 0;
        unpaidHours = 0;
      } else {
        // Insufficient balance - use available leave, rest is unpaid
        paidMinutes = Math.max(0, remainingBalanceMinutes);
        unpaidMinutes = leaveMinutes - paidMinutes;
        unpaidHours = Math.ceil(unpaidMinutes / 60);
      }

      // Utilize leave balance (if any available)
      if (paidMinutes > 0) {
        const result = await this.leaveBalanceUtil.utilizeLeave(
          leaveRequest.employeeId,
          month,
          year,
          paidMinutes,
        );

        if (!result.success) {
          throw new BadRequestException('Failed to utilize leave balance');
        }
      }

      // Create attendance record for unpaid leave (if any unpaid hours)
      if (unpaidMinutes > 0) {
        // Check if attendance already exists
        const existingAttendance = await this.attendanceModel.findOne({
          where: {
            employeeId: leaveRequest.employeeId,
            date: leaveDate,
          },
          transaction,
        });

        if (existingAttendance) {
          throw new BadRequestException('Attendance record already exists for this date');
        }

        // Create attendance record for unpaid leave
        await this.attendanceModel.create(
          {
            employeeId: leaveRequest.employeeId,
            date: leaveDate,
            checkInTime: undefined,
            checkOutTime: undefined,
            totalWorkedMinutes: 0,
            shortMinutes: unpaidMinutes, // Full day short minutes for unpaid leave
            salaryEarned: 0, // No salary for unpaid leave
            unpaidLeave: true, // Mark as unpaid leave
          } as any,
          { transaction },
        );
      }

      // Update leave request with unpaid hours
      await leaveRequest.update(
        {
          status: LeaveStatus.APPROVED,
          unpaidHours: unpaidHours,
        },
        { transaction },
      );

      await transaction.commit();

      // Build detailed message
      const totalApprovedHours = approvedRequests.reduce((sum, lr) => sum + lr.hours, 0) + leaveRequest.hours;
      const totalPaidHours = approvedRequests.reduce(
        (sum, lr) => sum + (lr.hours - (lr.unpaidHours || 0)),
        0,
      ) + (paidMinutes / 60);
      const totalUnpaidHours = approvedRequests.reduce(
        (sum, lr) => sum + (lr.unpaidHours || 0),
        0,
      ) + unpaidHours;

      let message = 'Leave request approved. ';
      
      if (isNextMonth) {
        message += `This is for next month (${month}/${year}), calculated as a fresh month. `;
      }

      if (approvedRequests.length === 0) {
        // First approved request for this month
        if (unpaidHours === 0) {
          message += `${(paidMinutes / 60).toFixed(1)} hours deducted from ${(balance.availableMinutes / 60).toFixed(1)} hours leave balance.`;
        } else {
          message += `${(paidMinutes / 60).toFixed(1)} hours deducted from ${(balance.availableMinutes / 60).toFixed(1)} hours leave balance, ${unpaidHours} hours marked as unpaid leave.`;
        }
      } else {
        // Multiple approved requests
        message += `You now have ${totalApprovedHours} hours of approved leave for this month: ${totalPaidHours.toFixed(1)} hours paid, ${totalUnpaidHours.toFixed(1)} hours unpaid.`;
      }

      return {
        id: leaveRequest.id,
        status: 'approved',
        paidHours: paidMinutes / 60,
        unpaidHours: unpaidHours,
        message,
        breakdown: {
          totalApprovedHours: totalApprovedHours,
          totalPaidHours: totalPaidHours,
          totalUnpaidHours: totalUnpaidHours,
          isNextMonth: isNextMonth,
        },
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async rejectLeaveRequest(id: string) {
    const leaveRequest = await this.leaveRequestModel.findByPk(id);

    if (!leaveRequest) {
      throw new NotFoundException('Leave request not found');
    }

    if (leaveRequest.status !== LeaveStatus.PENDING) {
      throw new BadRequestException('Leave request has already been processed');
    }

    await leaveRequest.update({ status: LeaveStatus.REJECTED });

    return {
      id: leaveRequest.id,
      status: 'rejected',
      message: 'Leave request rejected',
    };
  }

  async getEmployeeLeaveBalance(employeeId: string, month?: number, year?: number) {
    const employee = await this.employeeModel.findByPk(employeeId);
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const now = new Date();
    const targetMonth = month || now.getMonth() + 1;
    const targetYear = year || now.getFullYear();

    const balance = await this.leaveBalanceUtil.getCurrentBalance(
      employeeId,
      targetMonth,
      targetYear,
      employee.joiningDate,
    );

    return {
      employeeId,
      month: targetMonth,
      year: targetYear,
      balanceHours: balance.balanceMinutes / 60,
      utilizedHours: balance.utilizedMinutes / 60,
      availableHours: balance.availableMinutes / 60,
      carryoverHours: balance.carryoverMinutes / 60,
    };
  }

  /**
   * Create a public holiday and create attendance records for all employees
   */
  async createPublicHoliday(data: { date: string; name: string; description?: string }) {
    // Check if holiday already exists
    const existingHoliday = await this.publicHolidayModel.findOne({
      where: { date: data.date },
    });

    if (existingHoliday) {
      throw new BadRequestException('Public holiday already exists for this date');
    }

    const transaction = await this.sequelize.transaction();

    try {
      // Create public holiday
      const publicHoliday = await this.publicHolidayModel.create(
        {
          date: data.date,
          name: data.name,
          description: data.description || null,
        } as any,
        { transaction },
      );

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
        transaction,
      });

      // Create attendance records for all employees for this public holiday
      for (const employee of employees) {
        // Check if attendance already exists
        const existingAttendance = await this.attendanceModel.findOne({
          where: {
            employeeId: employee.id,
            date: data.date,
            deletedAt: null,
          },
          transaction,
        });

        if (!existingAttendance) {
          await this.attendanceModel.create(
            {
              employeeId: employee.id,
              date: data.date,
              checkInTime: null,
              checkOutTime: null,
              totalWorkedMinutes: 0,
              shortMinutes: 0,
              salaryEarned: 0,
              unpaidLeave: false,
              isPublicHoliday: true,
            } as any,
            { transaction },
          );
        } else {
          // Update existing attendance to mark as public holiday
          await existingAttendance.update(
            {
              isPublicHoliday: true,
              totalWorkedMinutes: 0,
              shortMinutes: 0,
              salaryEarned: 0,
            },
            { transaction },
          );
        }
      }

      await transaction.commit();

      return publicHoliday;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Get all public holidays
   */
  async getAllPublicHolidays(): Promise<PublicHoliday[]> {
    return this.publicHolidayModel.findAll({
      order: [['date', 'ASC']],
    });
  }

  /**
   * Get a public holiday by ID
   */
  async getPublicHolidayById(id: string): Promise<PublicHoliday> {
    const holiday = await this.publicHolidayModel.findByPk(id);
    if (!holiday) {
      throw new NotFoundException('Public holiday not found');
    }
    return holiday;
  }

  /**
   * Update a public holiday
   */
  async updatePublicHoliday(id: string, data: { name?: string; description?: string }) {
    const holiday = await this.publicHolidayModel.findByPk(id);
    if (!holiday) {
      throw new NotFoundException('Public holiday not found');
    }

    await holiday.update({
      name: data.name || holiday.name,
      description: data.description !== undefined ? data.description : holiday.description,
    });

    return holiday;
  }

  /**
   * Delete a public holiday
   */
  async deletePublicHoliday(id: string) {
    const holiday = await this.publicHolidayModel.findByPk(id);
    if (!holiday) {
      throw new NotFoundException('Public holiday not found');
    }

    const transaction = await this.sequelize.transaction();

    try {
      // Update attendance records to remove public holiday mark
      await this.attendanceModel.update(
        {
          isPublicHoliday: false,
        },
        {
          where: {
            date: holiday.date,
            isPublicHoliday: true,
          },
          transaction,
        },
      );

      // Delete the public holiday
      await holiday.destroy({ transaction });

      await transaction.commit();

      return { message: 'Public holiday deleted successfully' };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

