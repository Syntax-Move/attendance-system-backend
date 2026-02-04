import { registerAs } from '@nestjs/config';

/**
 * Attendance rules (PKT = Pakistan Time, Asia/Karachi).
 * Standard check-in time (m): e.g. 09:00 or 12:00 PKT.
 * Late: check-in > m + LATE_THRESHOLD_MINUTES.
 * Half-day: check-in > m + HALF_DAY_LATE_MINUTES (1 hour).
 * Working time: only [m, m + MAX_WORKING_MINUTES] counts; before m or after m+9h does not count.
 * Leaves: PAID_LEAVES_PER_MONTH_DAYS per month, MAX_CARRYOVER_LEAVE_DAYS carry to next month (x >= y).
 */
export default registerAs('attendance', () => {
  const standardCheckin = process.env.STANDARD_CHECKIN_TIME || '12:00'; // HH:mm in PKT
  const [stdHour, stdMin] = standardCheckin.split(':').map(Number);
  return {
    timezone: process.env.TIMEZONE || 'Asia/Karachi',
    /** Standard check-in time string "HH:mm" in PKT */
    standardCheckinTime: standardCheckin,
    /** Standard check-in hour (0-23) and minute (0-59) for building date */
    standardCheckinHour: stdHour,
    standardCheckinMinute: stdMin ?? 0,
    /** Minutes after standard check-in to mark as late */
    lateThresholdMinutes: parseInt(process.env.LATE_THRESHOLD_MINUTES || '15', 10),
    /** Minutes after standard check-in to mark as half-day (e.g. 60 = 1 hour) */
    halfDayLateMinutes: parseInt(process.env.HALF_DAY_LATE_MINUTES || '60', 10),
    /** Max working minutes from standard check-in (9 hours) */
    maxWorkingMinutes: parseInt(process.env.MAX_WORKING_MINUTES || '540', 10),
    /** Paid leave days per month (x) */
    paidLeavesPerMonthDays: parseFloat(process.env.PAID_LEAVES_PER_MONTH_DAYS || '2'),
    /** Max leave days that can carry over to next month (y), x >= y */
    maxCarryoverLeaveDays: parseFloat(process.env.MAX_CARRYOVER_LEAVE_DAYS || '1'),
    /** Minutes per full working day (9 hours) */
    minutesPerDay: 9 * 60,
  };
});
