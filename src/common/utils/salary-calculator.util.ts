export interface SalaryCalculationResult {
  totalWorkedMinutes: number;
  shortMinutes: number;
  monthlyShortMinutes: number;
  deductionMinutes: number;
  salaryEarned: number;
  deductedAmount: number;
}

export class SalaryCalculator {
  private static readonly REQUIRED_MINUTES_PER_DAY = 9 * 60; // 9 hours
  private static readonly ALLOWED_SHORT_MINUTES_PER_MONTH = 6 * 60; // 6 hours

  /**
   * Calculate salary for a checkout
   */
  static calculateSalary(
    checkInTime: Date,
    checkOutTime: Date,
    dailySalary: number,
    monthlyShortMinutesSoFar: number,
  ): SalaryCalculationResult {
    // Calculate worked minutes
    const totalWorkedMinutes = Math.floor(
      (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60),
    );

    // Calculate short minutes (if worked less than required)
    const shortMinutes = Math.max(
      0,
      this.REQUIRED_MINUTES_PER_DAY - totalWorkedMinutes,
    );

    // Total short minutes for the month including today
    const monthlyShortMinutes = monthlyShortMinutesSoFar + shortMinutes;

    // Calculate deduction minutes (only if exceeds allowance)
    const deductionMinutes = Math.max(
      0,
      monthlyShortMinutes - this.ALLOWED_SHORT_MINUTES_PER_MONTH,
    );

    // Calculate per-minute salary rate
    const perMinuteSalary = dailySalary / this.REQUIRED_MINUTES_PER_DAY;

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
  static getRequiredMinutesPerDay(): number {
    return this.REQUIRED_MINUTES_PER_DAY;
  }

  /**
   * Get allowed short minutes per month
   */
  static getAllowedShortMinutesPerMonth(): number {
    return this.ALLOWED_SHORT_MINUTES_PER_MONTH;
  }
}

