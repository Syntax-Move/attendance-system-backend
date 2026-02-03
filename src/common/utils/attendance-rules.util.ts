import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const PKT_UTC_OFFSET_HOURS = 5;

export interface AttendanceRulesConfig {
  standardCheckinHour: number;
  standardCheckinMinute: number;
  lateThresholdMinutes: number;
  halfDayLateMinutes: number;
  maxWorkingMinutes: number;
}

/**
 * Utilities for attendance rules in PKT (Pakistan Time, UTC+5).
 * - Standard check-in (m) on a date: e.g. 09:00 PKT.
 * - Late: check-in > m + lateThresholdMinutes.
 * - Half-day: check-in > m + halfDayLateMinutes (e.g. 1 hour).
 * - Working window: only [m, m + maxWorkingMinutes] counts.
 */
@Injectable()
export class AttendanceRulesUtil {
  private readonly config: AttendanceRulesConfig;

  constructor(private configService: ConfigService) {
    const att = this.configService.get('attendance');
    this.config = {
      standardCheckinHour: att?.standardCheckinHour ?? 9,
      standardCheckinMinute: att?.standardCheckinMinute ?? 0,
      lateThresholdMinutes: att?.lateThresholdMinutes ?? 15,
      halfDayLateMinutes: att?.halfDayLateMinutes ?? 60,
      maxWorkingMinutes: att?.maxWorkingMinutes ?? 540,
    };
  }

  /**
   * Get standard check-in datetime (UTC) for a given date.
   * Date is the calendar date (DATEONLY); time is standard check-in in PKT converted to UTC.
   */
  getStandardCheckinForDate(date: Date): Date {
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth();
    const d = date.getUTCDate();
    const utcHour = this.config.standardCheckinHour - PKT_UTC_OFFSET_HOURS;
    return new Date(Date.UTC(y, m, d, utcHour, this.config.standardCheckinMinute, 0, 0));
  }

  /**
   * Get working window end (m + maxWorkingMinutes) in UTC for the given date.
   */
  getWorkingWindowEndForDate(date: Date): Date {
    const start = this.getStandardCheckinForDate(date);
    return new Date(start.getTime() + this.config.maxWorkingMinutes * 60 * 1000);
  }

  /**
   * True if check-in time is more than lateThresholdMinutes after standard check-in (PKT).
   * checkInTime should be in UTC (as stored in DB).
   */
  isLate(checkInTime: Date, date: Date): boolean {
    const standardStart = this.getStandardCheckinForDate(date);
    const lateThresholdMs = this.config.lateThresholdMinutes * 60 * 1000;
    return checkInTime.getTime() > standardStart.getTime() + lateThresholdMs;
  }

  /**
   * True if check-in time is more than halfDayLateMinutes (e.g. 1 hour) after standard check-in.
   */
  isHalfDay(checkInTime: Date, date: Date): boolean {
    const standardStart = this.getStandardCheckinForDate(date);
    const halfDayMs = this.config.halfDayLateMinutes * 60 * 1000;
    return checkInTime.getTime() > standardStart.getTime() + halfDayMs;
  }

  /**
   * Compute working minutes for the day: only time within [m, m+maxWorkingMinutes] counts.
   * Check-in/check-out before m don't count; after m+9h don't count.
   */
  computeWorkingMinutes(
    checkInTime: Date,
    checkOutTime: Date,
    date: Date,
  ): number {
    const windowStart = this.getStandardCheckinForDate(date);
    const windowEnd = this.getWorkingWindowEndForDate(date);
    const effectiveStart = new Date(Math.max(checkInTime.getTime(), windowStart.getTime()));
    const effectiveEnd = new Date(Math.min(checkOutTime.getTime(), windowEnd.getTime()));
    if (effectiveEnd <= effectiveStart) return 0;
    return Math.floor((effectiveEnd.getTime() - effectiveStart.getTime()) / (60 * 1000));
  }

  /**
   * Required minutes for the day: 540 (full day) or 270 (half day).
   */
  getRequiredMinutesForDay(isHalfDay: boolean): number {
    return isHalfDay ? this.config.maxWorkingMinutes / 2 : this.config.maxWorkingMinutes;
  }

  getConfig(): AttendanceRulesConfig {
    return { ...this.config };
  }
}
