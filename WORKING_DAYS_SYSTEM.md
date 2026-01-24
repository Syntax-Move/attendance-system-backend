# Working Days Calculation System

## Overview

This document describes the working days calculation system implemented in the attendance management system. The system ensures that working days are calculated independently of check-in/check-out records, based on actual calendar working days (Monday to Friday) excluding public holidays.

## Key Features

1. **Independent Working Days Calculation**: Working days are counted based on calendar days (Monday-Friday), not on attendance records
2. **Public Holiday Exclusion**: Public holidays are automatically excluded from working days count
3. **Automatic Attendance Record Creation**: When any get attendance endpoint is triggered, the system automatically creates attendance records for all past working days in the current month that don't have records. These are marked as unpaid leave (not requested).
4. **Automatic Leave Deduction**: Missing attendance on working days automatically deducts from leave balance first
5. **Short Minutes Calculation**: After leave balance is exhausted, missing days are counted as short minutes (full day = 540 minutes). Dashboard stats now include missing past working days in short minutes calculation.
6. **Unpaid Leave Support**: Users can request leave even with insufficient balance. Approved leave requests deduct available balance first, and remaining hours are marked as unpaid leave with attendance records created
7. **Inactive Attendance Records**: System automatically creates inactive attendance records for current working day. Records become active when employee checks in.
8. **Automatic Checkout**: Cron job at 00:00 PKT automatically checks out employees who didn't check out the previous day.
9. **Record Activation**: Cron job automatically activates all previous inactive records at midnight.

## Working Days Definition

A day is considered a **working day** if:
- It is a weekday (Monday to Friday)
- It is NOT a public holiday (as defined in the `public_holidays` table)
- It falls within the month being calculated

## Database Schema

### Public Holidays Table

```sql
CREATE TABLE public_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  name VARCHAR NOT NULL,
  description VARCHAR,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Fields:**
- `id`: Unique identifier
- `date`: Date of the holiday (YYYY-MM-DD format)
- `name`: Name/description of the holiday
- `description`: Optional additional notes

### Attendance Table Updates

Added fields:
- `unpaidLeave` (BOOLEAN): True if this is an unpaid leave day (no check-in/check-out). Can be:
  - **Auto-created for missing past working days** (not requested, just system-generated when GET attendance endpoints are called)
  - Created when a leave request is approved with insufficient balance (requested unpaid leave)
- `isPublicHoliday` (BOOLEAN): True if this is a public holiday
- `isActive` (BOOLEAN): True if this attendance record is active (has check-in or is past date). New records for current day are created as inactive until check-in.

### Leave Request Table Updates

Added field:
- `unpaidHours` (INTEGER): Number of unpaid hours when leave balance is insufficient

## Unpaid Leave System

### Overview

The system supports unpaid leave requests when employees have insufficient leave balance. Users can request leave even with 0 or insufficient leave balance. When a leave request is approved:

1. **If leave balance is sufficient**: All hours are deducted from leave balance, `unpaidHours: 0`
2. **If leave balance is insufficient**: 
   - Available leave balance is deducted first
   - Remaining hours are marked as unpaid leave
   - An attendance record is created with:
     - `checkInTime`: null
     - `checkOutTime`: null
     - `unpaidLeave`: true
     - `totalWorkedMinutes`: 0
     - `shortMinutes`: unpaid minutes (e.g., 540 minutes for full day)
     - `salaryEarned`: 0

### Leave Request Process

1. **User submits leave request**: Can request leave even with 0 or insufficient balance (no validation error)
   - **Frontend UI Features**:
     - Real-time unpaid hours calculation display when requested hours exceed available balance
     - Formula shown: `X - B = Z` (Requested Hours - Available Balance = Unpaid Hours)
     - Visual indicator with orange background showing unpaid hours calculation
     - Warning message: "Insufficient balance - excess hours will be unpaid leave"
     - Confirmation dialog before submitting requests with unpaid hours
     - Success message includes note about unpaid hours when applicable
2. **Admin approves request**: 
   - System checks available leave balance
   - Deducts available balance (if any)
   - Calculates unpaid hours
   - Creates attendance record for unpaid leave (if any unpaid hours)
   - Updates leave request with `unpaidHours` field

### Example Scenarios

**Scenario 1: Sufficient Balance**
- Request: 9 hours
- Available balance: 15 hours
- Result: 9 hours deducted from balance, 0 unpaid hours, no attendance record created

**Scenario 2: Partial Balance**
- Request: 9 hours
- Available balance: 3 hours
- Result: 3 hours deducted from balance, 6 hours unpaid leave
- Attendance record created: `unpaidLeave: true`, `shortMinutes: 360` (6 hours)

**Scenario 3: No Balance**
- Request: 9 hours
- Available balance: 0 hours
- Result: 0 hours deducted, 9 hours unpaid leave
- Attendance record created: `unpaidLeave: true`, `shortMinutes: 540` (9 hours)

## How It Works

### 1. Automatic Attendance Record Creation

**When any get attendance endpoint is triggered**, the system automatically:
- Checks all past working days in the current month
- For each past working day without an attendance record:
  - Creates an attendance record marked as `unpaidLeave: true`
  - Sets `checkInTime: null`, `checkOutTime: null`
  - Sets `totalWorkedMinutes: 0`, `shortMinutes: 540` (full day), `salaryEarned: 0`
  - Sets `isPublicHoliday: false`
- **Excludes**: Weekends (Saturday/Sunday) and public holidays
- **Only processes**: Past dates (up to today), not future dates

**Endpoints that trigger this auto-creation:**
- `GET /attendance/my-history` (Employee)
- `GET /attendance` (Admin)
- `GET /admin/attendance` (Admin)
- `GET /attendance/dashboard` (Employee)
- `GET /attendance/today` (Employee)

**Important Notes:**
- These auto-created records are marked as unpaid leave but are **NOT requested unpaid leave**
- They represent missing attendance that was automatically detected and recorded
- They appear in attendance history with `unpaidLeave: true` but without a corresponding leave request
- This ensures all past working days have attendance records for accurate reporting

### 2. Working Days Calculation

The `WorkingDaysUtil` class provides methods to calculate working days:

```typescript
// Count working days in a month (excluding public holidays)
const workingDays = WorkingDaysUtil.countWorkingDays(month, year, publicHolidayDates);

// Get all working day dates in a month
const workingDayDates = WorkingDaysUtil.getWorkingDays(month, year, publicHolidayDates);

// Check if a specific date is a working day
const isWorking = WorkingDaysUtil.isWorkingDay(date, publicHolidayDates);
```

### 3. Missing Attendance Processing

The `MissingAttendanceProcessorService` handles processing of missing attendance:

**Process Flow:**
1. Identifies all working days in the month (excluding public holidays)
2. Filters working days up to today (doesn't process future dates)
3. Finds working days without attendance records
4. For each missing day:
   - **First**: Deducts from leave balance (if available)
     - Full day = 540 minutes (9 hours)
     - Deducts up to available leave balance
   - **Then**: If leave balance is exhausted, counts remaining minutes as short minutes
   - Updates monthly summary with short minutes

**Example:**
- Employee has 300 minutes leave balance
- Missing 1 working day = 540 minutes
- Result: 300 minutes deducted from leave, 240 minutes added to short minutes

### 4. Unpaid Leave Handling

**Two Types of Unpaid Leave:**

1. **Auto-Created Unpaid Leave** (Not Requested):
   - Created automatically when fetching attendance records
   - Represents missing attendance on past working days
   - Marked with `unpaidLeave: true`
   - No corresponding leave request exists
   - `shortMinutes: 540` (full day), `salaryEarned: 0`

2. **Requested Unpaid Leave**:
   - Created when a leave request is approved with insufficient balance
   - User explicitly requested leave
   - Marked with `unpaidLeave: true`
   - Has a corresponding leave request with `unpaidHours > 0`
   - `shortMinutes: unpaid minutes`, `salaryEarned: 0`

When a leave request is approved with insufficient balance:
- Available leave balance is deducted first
- Remaining hours are stored in `unpaidHours` field of leave request
- Attendance record is created with `unpaidLeave: true`
- No check-in/check-out times are recorded
- Salary earned is 0 for unpaid leave days
- Short minutes are set to unpaid minutes (e.g., 540 for full day)

### 5. User Dashboard Display

The user dashboard (`GET /attendance/dashboard`) shows:
- `workingDays`: Total working days in the month (excluding public holidays)
- `daysWorked`: Number of days with check-in/check-out records
- `totalShortMinutes`: Total short minutes (including missing days and unpaid leave)
- `leaveBalance`: Current leave balance after deductions
- `leaveRequests`: Includes `unpaidHours` field for approved requests

### 6. Frontend Unpaid Leave Request UI

The frontend provides a comprehensive UI for requesting unpaid leave:

**Real-time Calculation Display:**
- When user selects hours that exceed available balance, a calculation box appears
- Shows formula: `Requested Hours - Available Balance = Unpaid Hours`
- Example: `9 - 3.0 = 6.0 hours`
- Displays message: "X hours will be marked as unpaid leave if approved"
- Visual styling with orange theme (#FFF3E0 background, #FF9800 border) for visibility

**Confirmation Dialog:**
- When submitting a request with insufficient balance, a confirmation dialog appears
- Shows the calculation: `X - B = Z hours`
- Explains that Z hours will be unpaid if approved
- User can cancel or continue with the request

**Leave Request Display:**
- Approved leave requests show unpaid hours in the format: "9 hours (6 hrs unpaid)"
- Unpaid hours displayed in orange color for visual distinction
- Only shown for approved requests with `unpaidHours > 0`

**Attendance History Display:**
- Unpaid leave records appear in attendance history with distinct styling
- Shows "Unpaid Leave" badge with orange color (#FF9800)
- Displays "Auto-created (not requested)" message for system-generated records
- No check-in/check-out times shown (as per system design)
- Public holidays are shown with blue badge (#1976D2)

**Inactive Records:**
- Current day records are created as inactive (`isActive: false`) until check-in
- When employee checks in, the record becomes active (`isActive: true`)
- Previous day inactive records are automatically activated at midnight
- Inactive records don't affect calculations until activated

## Automatic Record Creation Behavior

### When GET Attendance Endpoints Are Called

All GET attendance endpoints automatically ensure that past working days in the current month have attendance records:

**Endpoints that trigger auto-creation:**
- `GET /attendance/today` - Ensures current month past working days for the employee
- `GET /attendance/my-history` - Ensures current month past working days for the employee
- `GET /attendance/dashboard` - Ensures current month past working days for the employee
- `GET /admin/attendance` - Ensures current month past working days for all employees (or filtered employee)

**What happens:**
1. System identifies all working days in current month (Monday-Friday, excluding public holidays)
2. Filters to only past dates (up to today)
3. For each past working day without an attendance record:
   - Creates attendance record with `unpaidLeave: true`
   - Sets `shortMinutes: 540` (full day)
   - Sets `salaryEarned: 0`
   - No check-in/check-out times
   - **No leave request is created** - this is automatic tracking

**Important Notes:**
- Only processes past dates (not future)
- Only processes working days (Monday-Friday)
- Excludes public holidays
- Creates records silently in the background
- Records are marked as unpaid leave but NOT as requested

## API Endpoints

### Process Missing Attendance

**Endpoint**: `POST /attendance/process-missing`  
**Access**: Admin only

**Query Parameters:**
- `employeeId` (optional): Process for specific employee. If omitted, processes for all employees.

**Response:**
```json
{
  "processedDays": 5,
  "leaveDeducted": 1500,
  "shortMinutesAdded": 1200
}
```

**When to Use:**
- Run daily (via scheduled job or manual trigger)
- After adding public holidays
- When you need to recalculate missing attendance

### Approve Leave Request

**Endpoint**: `PATCH /admin/leave-requests/:id/approve`  
**Access**: Admin only

**Description**: Approves a leave request. If leave balance is sufficient, deducts from balance. If insufficient, deducts available balance and marks remaining hours as unpaid leave. Creates attendance record for unpaid leave.

**Response:**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "status": "approved",
  "paidHours": 3.0,
  "unpaidHours": 6,
  "message": "Leave request approved. 3.0 hours deducted from leave balance, 6 hours marked as unpaid leave."
}
```

**Behavior:**
- If leave balance is sufficient: All hours deducted from balance, `unpaidHours: 0`, no attendance record created
- If leave balance is insufficient: Available balance deducted, remaining hours marked as unpaid, attendance record created with `unpaidLeave: true`

## Implementation Details

### Monthly Summary Updates

When missing attendance is processed:
- `totalShortMinutes` in `monthly_attendance_summaries` is updated
- Leave balance is automatically deducted
- Short minutes are calculated after leave deduction

### Leave Balance Deduction

- Deduction happens automatically when processing missing attendance
- Full day = 540 minutes (9 hours)
- If leave balance is insufficient, remaining minutes go to short minutes
- Leave balance is updated in real-time

### Short Minutes Calculation

- Short minutes = minutes not covered by leave balance
- Full missing day = 540 minutes
- Short minutes are added to monthly summary
- Used for salary deduction calculations

## Usage Examples

### Adding Public Holidays

```typescript
// Via API or directly in database
INSERT INTO public_holidays (date, name, description)
VALUES ('2024-01-26', 'Republic Day', 'National holiday');
```

### Processing Missing Attendance

```typescript
// Process for all employees
POST /attendance/process-missing

// Process for specific employee
POST /attendance/process-missing?employeeId=123e4567-e89b-12d3-a456-426614174000
```

### Getting Working Days Count

```typescript
// In service code
const publicHolidays = await publicHolidayModel.findAll({...});
const holidayDates = publicHolidays.map(h => h.date.toISOString().split('T')[0]);
const workingDays = WorkingDaysUtil.countWorkingDays(month, year, holidayDates);
```

## Scheduled Processing (Cron Jobs)

The system includes automatic cron jobs that run at 00:00 PKT (Pakistan Time):

### 1. Auto Checkout Cron Job

**Schedule**: `0 0 * * *` (00:00 PKT daily)  
**Purpose**: Automatically checks out employees who checked in but didn't check out the previous day

**What it does:**
- Finds all employees who checked in yesterday but didn't check out
- Automatically sets checkout time to 23:59:59 of previous day
- Calculates salary, short minutes, and leave deductions
- Updates monthly attendance summary
- Activates the attendance record

### 2. Create Inactive Records Cron Job

**Schedule**: `0 0 * * *` (00:00 PKT daily)  
**Purpose**: Creates inactive attendance records for current working day and activates previous inactive records

**What it does:**
- Checks if today is a working day (Monday-Friday, not a public holiday)
- Creates inactive attendance records for all active employees for today
- Records are marked as `isActive: false` until employee checks in
- Activates all previous inactive records (all past dates become active)

**Benefits:**
- Ensures all working days have attendance records ready
- Prevents missing records for current day
- Automatically tracks attendance even before check-in

### 3. Manual Processing (Optional)

You can also manually process missing attendance:

```typescript
// Process for all employees
POST /attendance/process-missing

// Process for specific employee
POST /attendance/process-missing?employeeId=123e4567-e89b-12d3-a456-426614174000
```

This ensures:
- Missing attendance is processed automatically
- Leave balances are updated daily
- Short minutes are calculated in real-time
- All working days have attendance records

## Important Notes

1. **Future Dates**: The system only processes dates up to today. Future dates are not processed.

2. **Public Holidays**: Must be added to the `public_holidays` table before processing. Holidays added after processing will not affect already processed months.

3. **Leave Balance Priority**: Leave balance is always deducted first. Short minutes are only counted after leave is exhausted.

4. **Full Day Calculation**: A missing working day is always counted as 540 minutes (9 hours), regardless of actual work hours.

5. **Re-processing**: Running the process multiple times is safe - it only processes days that don't have attendance records.

6. **Unpaid Leave Requests**: Users can request leave even with 0 or insufficient balance. The frontend UI provides:
   - Real-time calculation display showing unpaid hours (X - B = Z)
   - Visual warnings when balance is insufficient
   - Confirmation dialog before submitting unpaid leave requests
   - Clear indication of how many hours will be unpaid
   - When approved, available balance is deducted first, and remaining hours are marked as unpaid leave

7. **Automatic Unpaid Leave Records**: When GET attendance endpoints are called, the system automatically creates attendance records for all past working days in the current month that don't have records. These are marked as `unpaidLeave: true` but are NOT requested - they're system-generated for tracking purposes.

8. **Requested vs Auto-Created Unpaid Leave**: 
   - **Requested unpaid leave**: Created when a leave request is approved with insufficient balance (has associated leave request)
   - **Auto-created unpaid leave**: Created automatically by system when GET attendance is called (no leave request, just tracking)

9. **Unpaid Leave Attendance Records**: Attendance records for unpaid leave have no check-in/check-out times, `unpaidLeave: true`, `salaryEarned: 0`, and `shortMinutes` set to unpaid minutes. These records are displayed in attendance history with distinct styling (orange badge, "Unpaid Leave" status, "Auto-created (not requested)" message for system-generated records).

10. **Frontend Calculation Display**: The unpaid hours calculation is shown in real-time as users select hours:
   - Formula: `Requested Hours - Available Balance = Unpaid Hours`
   - Only displayed when requested hours exceed available balance
   - Updates automatically when hours or balance changes
   - Styled with orange theme for visibility and warning indication

## Migration Guide

### For Existing Data

1. Run the migrations to create `public_holidays` table and add unpaid leave fields:
   ```bash
   npx sequelize-cli db:migrate
   ```

2. Add public holidays for the current year:
   ```sql
   INSERT INTO public_holidays (date, name) VALUES
   ('2024-01-26', 'Republic Day'),
   ('2024-08-15', 'Independence Day'),
   -- Add more holidays as needed
   ```

3. Process missing attendance for current month:
   ```bash
   POST /attendance/process-missing
   ```

4. Verify working days count in user dashboard:
   ```bash
   GET /attendance/dashboard
   ```

## Troubleshooting

### Working Days Count is Wrong

- Check if public holidays are added correctly
- Verify the month/year being calculated
- Ensure the date format is correct (YYYY-MM-DD)

### Missing Attendance Not Processed

- Check if the date is a working day (Monday-Friday)
- Verify if it's a public holiday
- Ensure the date is not in the future
- Check if attendance record already exists

### Leave Balance Not Deducted

- Verify leave balance is available
- Check if the day was already processed
- Ensure the employee has a leave balance record for the month

## Related Files

### Backend
- `src/common/utils/working-days.util.ts`: Working days calculation utilities
- `src/attendance/missing-attendance-processor.service.ts`: Missing attendance processing service
- `src/database/models/public-holiday.model.ts`: Public holiday model
- `src/database/migrations/20240120000006-create-public-holidays.js`: Migration file
- `src/database/migrations/20240120000007-add-unpaid-leave-fields.js`: Migration file for unpaid leave fields

### Frontend
- `src/screens/LeaveRequestScreen.tsx`: Leave request UI with unpaid hours calculation display
- `src/screens/HistoryScreen.tsx`: Attendance history display with unpaid leave records
- `src/context/AttendanceContext.tsx`: Context handling unpaid leave records and leave requests
- `src/services/api.ts`: API interfaces including `unpaidLeave` and `unpaidHours` fields

## Version History

- **v1.4** (2024-01-26): Enhanced stats calculation and cron jobs
  - Dashboard stats now include missing past working days in short minutes calculation
  - Added `isActive` field to attendance records
  - Cron job at 00:00 PKT automatically checks out employees who didn't check out yesterday
  - Cron job creates inactive attendance records for current working day
  - Cron job activates all previous inactive records at midnight
  - Check-in logic activates inactive records when employee checks in
  - Missing past working days are now included in short minutes calculation for accurate stats

- **v1.3** (2024-01-26): Automatic attendance record creation
  - Auto-creates attendance records for past working days in current month when any get attendance endpoint is called
  - Missing past working days are marked as unpaid leave (not requested)
  - Works for both employee and admin endpoints
  - Excludes weekends and public holidays
  - Only processes past dates (up to today)

- **v1.2** (2024-01-25): Frontend unpaid leave UI implementation
  - Real-time unpaid hours calculation display (X - B = Z formula)
  - Visual indicators for unpaid leave requests
  - Confirmation dialog for unpaid leave submissions
  - Unpaid leave records display in attendance history
  - Leave requests show unpaid hours for approved requests
  - No validation blocking for insufficient balance requests

- **v1.1** (2024-01-24): Unpaid leave support
  - Users can request leave with insufficient balance
  - Partial leave deduction + unpaid leave
  - Attendance records for unpaid leave
  - Admin panel displays unpaid leave information
  - Leave request includes `unpaidHours` field

- **v1.0** (2024-01-24): Initial implementation
  - Working days calculation independent of attendance
  - Public holiday support
  - Automatic leave deduction
  - Short minutes calculation

