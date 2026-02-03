import { Injectable } from '@nestjs/common';
import { AttendanceRulesUtil } from './attendance-rules.util';

export interface SalaryCalculationResult {
  totalWorkedMinutes: number;
  shortMinutes: number;
  monthlyShortMinutes: number;
  deductionMinutes: number;
  salaryEarned: number;
  deductedAmount: number;
}

/**
 * Salary calculation using attendance rules:
 * - Working time only [m, m+9h]; before m or after m+9h does not count.
 * - Half-day: required = 270 min, full day = 540 min.
 * - No monthly short-minutes allowance: short minutes after leave are fully deducted from salary.
 */
@Injectable()
export class SalaryCalculator {
  constructor(private attendanceRules: AttendanceRulesUtil) {}

  /**
   * Calculate salary for a checkout.
   * Uses working window [standard check-in, standard check-in + 9h] and half-day rule.
   */
  calculateSalary(
    checkInTime: Date,
    checkOutTime: Date,
    date: Date,
    isHalfDay: boolean,
    dailySalary: number,
    monthlyShortMinutesSoFar: number,
    availableLeaveBalance: number = 0,
  ): SalaryCalculationResult {
    const totalWorkedMinutes = this.attendanceRules.computeWorkingMinutes(
      checkInTime,
      checkOutTime,
      date,
    );
    const requiredMinutes = this.attendanceRules.getRequiredMinutesForDay(isHalfDay);
    const shortMinutes = Math.max(0, requiredMinutes - totalWorkedMinutes);
    const dailySalaryProportion = isHalfDay ? 0.5 : 1;
    const effectiveDailySalary = dailySalary * dailySalaryProportion;

    const monthlyShortMinutes = monthlyShortMinutesSoFar + shortMinutes;
    const shortMinutesAfterLeave = Math.max(0, monthlyShortMinutes - availableLeaveBalance);
    const deductionMinutes = shortMinutesAfterLeave;

    const perMinuteSalary = effectiveDailySalary / requiredMinutes;
    const deductedAmount = deductionMinutes * perMinuteSalary;
    const salaryEarned = Math.max(0, effectiveDailySalary - deductedAmount);

    return {
      totalWorkedMinutes,
      shortMinutes,
      monthlyShortMinutes,
      deductionMinutes,
      salaryEarned,
      deductedAmount,
    };
  }

  getRequiredMinutesPerDay(isHalfDay: boolean): number {
    return this.attendanceRules.getRequiredMinutesForDay(isHalfDay);
  }

  /** No monthly allowance in new system; returns 0 for compatibility. */
  getAllowedShortMinutesPerMonth(): number {
    return 0;
  }
}
