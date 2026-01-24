/**
 * Utility to calculate working days (Monday to Friday) in a month
 * Excludes public holidays when provided
 */
export class WorkingDaysUtil {
  /**
   * Count working days (Monday to Friday) in a given month
   * @param month Month number (1-12)
   * @param year Year (e.g., 2024)
   * @param publicHolidays Optional array of public holiday dates (YYYY-MM-DD format strings or Date objects)
   * @returns Number of working days (typically 21, 22, or 23, minus public holidays)
   */
  static countWorkingDays(
    month: number,
    year: number,
    publicHolidays?: (string | Date)[],
  ): number {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    let count = 0;

    // Convert public holidays to date strings for comparison
    const holidayDates: string[] = publicHolidays
      ? publicHolidays.map((h) => {
          if (h instanceof Date) {
            return h.toISOString().split('T')[0];
          }
          return h;
        })
      : [];

    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      const dayOfWeek = date.getDay();
      // Monday = 1, Friday = 5
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        // Check if it's a public holiday
        const dateStr = date.toISOString().split('T')[0];
        if (!holidayDates.includes(dateStr)) {
          count++;
        }
      }
    }

    return count;
  }

  /**
   * Get all working days (dates) in a given month, excluding public holidays
   * @param month Month number (1-12)
   * @param year Year (e.g., 2024)
   * @param publicHolidays Optional array of public holiday dates
   * @returns Array of Date objects representing working days
   */
  static getWorkingDays(
    month: number,
    year: number,
    publicHolidays?: (string | Date)[],
  ): Date[] {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    const workingDays: Date[] = [];

    // Convert public holidays to date strings for comparison
    const holidayDates: string[] = publicHolidays
      ? publicHolidays.map((h) => {
          if (h instanceof Date) {
            return h.toISOString().split('T')[0];
          }
          return h;
        })
      : [];

    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      const dayOfWeek = date.getDay();
      // Monday = 1, Friday = 5
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        // Check if it's a public holiday
        const dateStr = date.toISOString().split('T')[0];
        if (!holidayDates.includes(dateStr)) {
          workingDays.push(new Date(date));
        }
      }
    }

    return workingDays;
  }

  /**
   * Check if a date is a working day (Monday to Friday and not a public holiday)
   * @param date Date to check
   * @param publicHolidays Optional array of public holiday dates
   * @returns true if the date is a working day
   */
  static isWorkingDay(date: Date, publicHolidays?: (string | Date)[]): boolean {
    const dayOfWeek = date.getDay();
    // Check if it's a weekday (Monday to Friday)
    if (dayOfWeek < 1 || dayOfWeek > 5) {
      return false;
    }

    // Check if it's a public holiday
    if (publicHolidays && publicHolidays.length > 0) {
      const dateStr = date.toISOString().split('T')[0];
      const holidayDates = publicHolidays.map((h) => {
        if (h instanceof Date) {
          return h.toISOString().split('T')[0];
        }
        return h;
      });
      if (holidayDates.includes(dateStr)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculate daily salary from monthly salary based on working days in the month
   * @param monthlySalary Monthly salary amount
   * @param month Month number (1-12)
   * @param year Year (e.g., 2024)
   * @param publicHolidays Optional array of public holiday dates
   * @returns Daily salary (monthlySalary / workingDays)
   */
  static calculateDailySalary(
    monthlySalary: number,
    month: number,
    year: number,
    publicHolidays?: (string | Date)[],
  ): number {
    const workingDays = this.countWorkingDays(month, year, publicHolidays);
    return monthlySalary / workingDays;
  }
}

