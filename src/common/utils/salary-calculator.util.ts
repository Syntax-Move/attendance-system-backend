import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SalaryCalculationResult {
  totalWorkedMinutes: number;
  shortMinutes: number;
  monthlyShortMinutes: number;
  deductionMinutes: number;
  salaryEarned: number;
  deductedAmount: number;
}

@Injectable()
export class SalaryCalculator {
  private static readonly REQUIRED_MINUTES_PER_DAY = 9 * 60; // 9 hours
  private readonly allowedShortMinutesPerMonth: number;

  constructor(private configService: ConfigService) {
    // Get from env, default to 10 hours (600 minutes)
    // Note: User mentioned 15 hours, but explicitly said "if not env then 10 hours in minutes by default"
    const envValue = this.configService.get<string>('MONTHLY_SHORT_MINUTES_ALLOWED');
    this.allowedShortMinutesPerMonth = envValue 
      ? parseInt(envValue, 10) 
      : 10 * 60; // Default: 10 hours = 600 minutes
  }

  /**
   * Calculate salary for a checkout
   * Now considers leave balance when calculating deductions
   */
  calculateSalary(
    checkInTime: Date,
    checkOutTime: Date,
    dailySalary: number,
    monthlyShortMinutesSoFar: number,
    availableLeaveBalance: number = 0, // Available leave balance in minutes
  ): SalaryCalculationResult {
    // Calculate worked minutes
    const totalWorkedMinutes = Math.floor(
      (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60),
    );

    // Calculate short minutes (if worked less than required)
    const shortMinutes = Math.max(
      0,
      SalaryCalculator.REQUIRED_MINUTES_PER_DAY - totalWorkedMinutes,
    );

    // Total short minutes for the month including today
    const monthlyShortMinutes = monthlyShortMinutesSoFar + shortMinutes;

    // Calculate deduction minutes considering leave balance
    // First, try to cover short minutes with leave balance
    const shortMinutesAfterLeave = Math.max(
      0,
      monthlyShortMinutes - availableLeaveBalance,
    );

    // Then calculate deduction minutes (only if exceeds allowance after using leave)
    const deductionMinutes = Math.max(
      0,
      shortMinutesAfterLeave - this.allowedShortMinutesPerMonth,
    );

    // Calculate per-minute salary rate
    const perMinuteSalary = dailySalary / SalaryCalculator.REQUIRED_MINUTES_PER_DAY;

    // Calculate deducted amount
    const deductedAmount = deductionMinutes * perMinuteSalary;

    // Calculate salary earned
    const salaryEarned = dailySalary - deductedAmount;

    return {
      totalWorkedMinutes,
      shortMinutes,
      monthlyShortMinutes,
      deductionMinutes,
      salaryEarned: Math.max(0, salaryEarned),
      deductedAmount,
    };
  }

  /**
   * Get required minutes per day
   */
  getRequiredMinutesPerDay(): number {
    return SalaryCalculator.REQUIRED_MINUTES_PER_DAY;
  }

  /**
   * Get allowed short minutes per month
   */
  getAllowedShortMinutesPerMonth(): number {
    return this.allowedShortMinutesPerMonth;
  }
}

