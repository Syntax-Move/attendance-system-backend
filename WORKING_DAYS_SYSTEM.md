# Working Days & Attendance System

## Overview

This document describes the attendance and working days system. The system is based on **check-in/check-out only**: no unpaid hours limits (e.g. 16 or 10 hours). Late marking, half-day, paid leaves, and working-time rules are defined below. All times are in **PKT (Pakistan Time, Asia/Karachi)** unless stated otherwise.

## Key Features

1. **Check-in / Check-out only** – No 16-hour or 10-hour unpaid limits; simple check-in and check-out.
2. **Late marking** – If a user checks in more than **n** minutes after **m** (standard check-in time) at PKT (e.g. 12:00 PM PKT), the day is marked as **late**.
3. **Half-day** – If a user checks in more than **1 hour** after standard check-in time, the day is marked as **half-day** (only half day counted for working time/salary).
4. **Paid leaves** – **x** paid leave days per month; **y** days can carry over to the next month (x ≥ y). Leaves are taken in multiples of **½ day** (half day, 1 day, 1.5 days, etc.). Excess leave beyond balance is **deducted from salary**.
5. **Working time** – Only time between **standard check-in (m)** and **m + 9 hours** counts. Check-in/check-out **before** standard time does **not** count as working hours. Check-out **after** 9 hours from standard check-in is **not** counted beyond 9 hours.
6. **Admin** – Admin can **create** an attendance entry (check-in/check-out for any date) and **modify** check-in/check-out of any user’s attendance for any date. Admin can choose any check-in and check-out time.

## Configuration (Environment / Backend)

| Variable | Description | Example |
|----------|-------------|--------|
| `STANDARD_CHECKIN_TIME` | Standard check-in time (HH:mm) in PKT | `09:00` or `12:00` |
| `LATE_THRESHOLD_MINUTES` | Minutes after standard check-in to mark as late | `15` |
| `HALF_DAY_LATE_MINUTES` | Minutes after standard check-in to mark as half-day | `60` |
| `MAX_WORKING_MINUTES` | Max working minutes from standard check-in (capped) | `540` (9 hours) |
| `PAID_LEAVES_PER_MONTH_DAYS` | Paid leave days per month (x) | `2` |
| `MAX_CARRYOVER_LEAVE_DAYS` | Max leave days that can carry to next month (y), x ≥ y | `1` |
| `TIMEZONE` | Timezone for attendance (e.g. PKT) | `Asia/Karachi` |

- **Late**: check-in time > m + `LATE_THRESHOLD_MINUTES` (in PKT) → `isLate = true`.
- **Half-day**: check-in time > m + `HALF_DAY_LATE_MINUTES` (in PKT) → `isHalfDay = true` (half day for salary/working time).
- **Working minutes**: Only the period within [m, m + 9h] counts; before m or after m+9h does not count. Capped at `MAX_WORKING_MINUTES`.

## Working Days Definition

A day is a **working day** if:

- It is a weekday (Monday–Friday),
- It is **not** a public holiday (from `public_holidays`),
- It falls within the month being considered.

## Database Schema

### Attendance Table

Relevant fields:

- `checkInTime`, `checkOutTime` – Check-in/check-out timestamps.
- `isLate` (BOOLEAN) – True if check-in was more than **n** minutes after standard check-in (m) at PKT.
- `isHalfDay` (BOOLEAN) – True if check-in was more than 1 hour after m (half day for salary/working time).
- `totalWorkedMinutes` – Working minutes (only within [m, m+9h], capped at 9 hours).
- `shortMinutes` – Shortfall vs required (full or half day).
- `salaryEarned` – Salary for the day (full or half day, minus deductions).
- `unpaidLeave` – True if no check-in/check-out (e.g. auto-created missing day or approved leave with no balance).
- `isPublicHoliday`, `isActive` – As before.

### Leave Request Table

- `days` (DECIMAL) – Leave in **days** in multiples of 0.5 (0.5, 1, 1.5, 2, …). 1 day = 1 full working day.
- `hours` (optional/legacy) – Can be derived as days × 9 for display.
- `unpaidDays` or equivalent – Excess days beyond leave balance (deducted from salary when approved).

### Leave Balance

- **x** paid leave days per month; **y** days carry over (x ≥ y).
- Stored in minutes internally: e.g. 1 day = 9 hours = 540 minutes.
- When user takes leave beyond balance, excess is **deducted from salary** (no separate “unpaid hours limit” like 16 or 10).

## Late and Half-Day Rules

- **Standard check-in time (m)** – e.g. 09:00 or 12:00 PKT (configurable).
- **Late**: If `checkInTime` (in PKT) > m + **n** minutes → mark **late** (`isLate = true`).
- **Half-day**: If `checkInTime` (in PKT) > m + **60** minutes → mark **half-day** (`isHalfDay = true`). That day is treated as half day for working time and salary (e.g. required minutes = 270, salary proportion = 0.5).

## Working Time Rules

- **Counting window**: From **m** (standard check-in time on that date, PKT) to **m + 9 hours**. Only this window counts as working time.
- **Check-in before m**: Allowed, but working time **starts at m**, not at actual check-in. Time before m does **not** count as working hours.
- **Check-out after m + 9 hours**: Time **after** m + 9 hours does **not** count. Working time is capped at 9 hours from m.
- **totalWorkedMinutes** = min(actual time within [m, m+9h], 540). **shortMinutes** = required minutes (540 or 270 for half-day) − totalWorkedMinutes (before leave/deduction logic).

## Paid Leaves (x per month, y carry-over)

- **x** = paid leave days per month (configurable).
- **y** = max days that can carry over to next month (x ≥ y).
- Leave is taken in **multiples of ½ day**: 0.5, 1, 1.5, 2, … days.
- If user takes leave **more than** available balance (current month + carry-over), the **excess is deducted from salary** (no separate “unpaid hours limit” like 16 or 10).
- When a leave request is approved: deduct from leave balance first; remaining days are salary deduction (e.g. create/update attendance and deduction ledger).

## Admin: Create & Edit Attendance

- **Create attendance**  
  Admin can create an attendance entry for **any employee** and **any date** with:
  - `employeeId`, `date`, `checkInTime`, `checkOutTime`  
  Admin can choose **any** check-in and check-out time. Backend applies the same rules: late, half-day, working window [m, m+9h], and salary calculation.

- **Edit attendance**  
  Admin can **modify** check-in and/or check-out of **any** existing attendance record (any user, any date). Same rules apply for recalculating late, half-day, working minutes, and salary.

- **Endpoints** (example):
  - `POST /admin/attendance` – Body: `{ employeeId, date, checkInTime, checkOutTime }`.
  - `PATCH /admin/attendance/:id` – Body: `{ checkInTime?, checkOutTime? }`.

## Automatic Record Creation & Missing Days

- For **past working days** in the current month that have **no** attendance record, the system can auto-create records (e.g. when GET attendance or dashboard is called). Those can be marked as unpaid leave / short and drive leave deduction and salary deduction as per the new rules (no 16/10 hour unpaid limit).
- **Inactive records** for the current day can still be created and activated on check-in or at midnight as before.

## API Summary (Admin & Backend)

### Attendance

- `GET /attendance/today` – Today’s status (employee).
- `POST /attendance/check-in` – Check-in (employee).
- `POST /attendance/check-out` – Check-out (employee).
- `GET /attendance/my-history` – My history (employee).
- `GET /admin/attendance` – List attendance with filters (admin).
- `POST /admin/attendance` – **Create** attendance for any employee/date with any check-in/check-out (admin).
- `PATCH /admin/attendance/:id` – **Update** check-in/check-out for any attendance (admin).
- `DELETE /admin/attendance/:id` – Delete attendance (admin).

### Leave

- Leave requests use **days** (0.5, 1, 1.5, …). Approve flow: deduct balance first; excess → salary deduction.
- Endpoints for leave request create/approve/reject and leave balance remain; request body uses `days` (and optionally `hours` for backward compatibility).

## Related Files (Backend)

- `src/config/attendance.config.ts` – Standard check-in, late/half-day thresholds, leave days, timezone.
- `src/common/utils/attendance-rules.util.ts` – Late/half-day and working-window logic (PKT).
- `src/common/utils/salary-calculator.util.ts` – Salary using working window and half-day.
- `src/common/utils/leave-balance.util.ts` – Leave balance in days (x per month, y carry-over).
- `src/attendance/attendance.service.ts` – Check-in/check-out, late/half-day, create/update.
- `src/admin/admin.controller.ts` / `admin.service.ts` – Create/update attendance.

## Related Files (Admin Panel)

- Attendance page – List, filters, **Create attendance**, **Edit** check-in/check-out per record.
- Leave requests – Request and display leave in **days** (0.5, 1, 1.5, …), balance in days.

## Version History

- **v2.0** – New working days system: check-in/check-out only; late (n min after m); half-day (>1h late); paid leaves x/month, y carry-over, in ½-day units; excess leave deducted from salary; working time only [m, m+9h]; admin create/edit attendance with any times.
- **v1.x** – Previous system (working days, unpaid hours, 16/10 hour limits, etc.).
