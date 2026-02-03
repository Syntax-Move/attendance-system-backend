import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Op } from 'sequelize';
import { LeaveBalance } from '../../database/models/leave-balance.model';
import { Employee } from '../../database/models/employee.model';

const MINUTES_PER_DAY = 9 * 60; // 1 day = 9 hours

@Injectable()
export class LeaveBalanceUtil {
  private get MONTHLY_LEAVE_MINUTES(): number {
    const att = this.configService.get('attendance');
    const days = att?.paidLeavesPerMonthDays ?? 2;
    return Math.round(days * MINUTES_PER_DAY);
  }

  private get MAX_CARRYOVER_MINUTES(): number {
    const att = this.configService.get('attendance');
    const days = att?.maxCarryoverLeaveDays ?? 1;
    return Math.round(days * MINUTES_PER_DAY);
  }

  constructor(
    @InjectModel(LeaveBalance)
    private leaveBalanceModel: typeof LeaveBalance,
    private sequelize: Sequelize,
    private configService: ConfigService,
  ) {}

  /**
   * Get or create leave balance for a month
   * If joining date is provided, calculate prorated leave for first month
   */
  async getOrCreateLeaveBalance(
    employeeId: string,
    month: number,
    year: number,
    joiningDate?: Date,
  ): Promise<LeaveBalance> {
    const [balance, created] = await this.leaveBalanceModel.findOrCreate({
      where: {
        employeeId,
        month,
        year,
      },
      defaults: {
        employeeId,
        month,
        year,
        balanceMinutes: this.calculateInitialBalance(month, year, joiningDate),
        utilizedMinutes: 0,
        carryoverMinutes: 0,
      } as any,
    });

    // If not created, check if we need to add carryover from previous month
    if (!created && balance.carryoverMinutes === 0) {
      const carryover = await this.calculateCarryover(employeeId, month, year);
      if (carryover > 0) {
        await balance.update({
          carryoverMinutes: carryover,
          balanceMinutes: this.MONTHLY_LEAVE_MINUTES + carryover,
        });
        return balance.reload();
      }
    }

    return balance;
  }

  /**
   * Calculate initial leave balance for first month based on joining date
   * Joining date is considered as the first day of the month for that employee
   */
  private calculateInitialBalance(
    month: number,
    year: number,
    joiningDate?: Date,
  ): number {
    if (!joiningDate) {
      return this.MONTHLY_LEAVE_MINUTES;
    }

    const joinDate = new Date(joiningDate);
    const joinMonth = joinDate.getMonth() + 1;
    const joinYear = joinDate.getFullYear();

    // If this is the joining month, calculate prorated leave
    if (month === joinMonth && year === joinYear) {
      // Joining date is considered as first day of month, so full month's leave
      return this.MONTHLY_LEAVE_MINUTES;
    }

    // For subsequent months, full leave balance
    return this.MONTHLY_LEAVE_MINUTES;
  }

  /**
   * Calculate carryover from previous month
   * Max carryover is 9 hours (540 minutes)
   */
  private async calculateCarryover(
    employeeId: string,
    month: number,
    year: number,
  ): Promise<number> {
    let prevMonth = month - 1;
    let prevYear = year;

    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear = year - 1;
    }

    const prevBalance = await this.leaveBalanceModel.findOne({
      where: {
        employeeId,
        month: prevMonth,
        year: prevYear,
      },
    });

    if (!prevBalance) {
      return 0;
    }

    // Calculate unused balance
    const unusedBalance = prevBalance.balanceMinutes - prevBalance.utilizedMinutes;

    // Max carryover is 9 hours (540 minutes)
    return Math.min(unusedBalance, this.MAX_CARRYOVER_MINUTES);
  }

  /**
   * Utilize leave balance
   * Returns true if balance was sufficient, false otherwise
   */
  async utilizeLeave(
    employeeId: string,
    month: number,
    year: number,
    minutes: number,
  ): Promise<{ success: boolean; remainingBalance: number }> {
    const balance = await this.getOrCreateLeaveBalance(employeeId, month, year);

    const availableBalance = balance.balanceMinutes - balance.utilizedMinutes;

    if (availableBalance < minutes) {
      return {
        success: false,
        remainingBalance: Math.max(0, availableBalance),
      };
    }

    await balance.update({
      utilizedMinutes: balance.utilizedMinutes + minutes,
    });

    return {
      success: true,
      remainingBalance: balance.balanceMinutes - (balance.utilizedMinutes + minutes),
    };
  }

  /**
   * Get current leave balance for an employee
   */
  async getCurrentBalance(
    employeeId: string,
    month: number,
    year: number,
    joiningDate?: Date,
  ): Promise<{
    balanceMinutes: number;
    utilizedMinutes: number;
    availableMinutes: number;
    carryoverMinutes: number;
  }> {
    const balance = await this.getOrCreateLeaveBalance(employeeId, month, year, joiningDate);

    return {
      balanceMinutes: balance.balanceMinutes,
      utilizedMinutes: balance.utilizedMinutes,
      availableMinutes: balance.balanceMinutes - balance.utilizedMinutes,
      carryoverMinutes: balance.carryoverMinutes,
    };
  }

  /**
   * Initialize leave balance for a new employee
   */
  async initializeLeaveBalance(
    employeeId: string,
    joiningDate: Date,
  ): Promise<void> {
    const joinDate = new Date(joiningDate);
    const month = joinDate.getMonth() + 1;
    const year = joinDate.getFullYear();

    await this.getOrCreateLeaveBalance(employeeId, month, year, joiningDate);
  }
}

