# API Documentation

Complete API documentation for the Attendance System Backend.

**Base URL**: `http://localhost:3000` (or your deployed URL)  
**API Version**: 1.0  
**Documentation**: Interactive Swagger UI available at `/docs`

---

## Table of Contents

1. [Authentication](#authentication)
2. [Attendance Endpoints](#attendance-endpoints)
3. [Employee Management](#employee-management)
4. [Admin Endpoints](#admin-endpoints)
5. [Error Responses](#error-responses)
6. [Data Models](#data-models)

---

## Authentication

All protected endpoints require a JWT Bearer token in the Authorization header.

**Format**: `Authorization: Bearer <token>`

### Login

Authenticate and receive a JWT access token.

**Endpoint**: `POST /auth/login`  
**Access**: Public

**Request Body**:
```json
{
  "email": "employee@example.com",
  "password": "password123"
}
```

**Response** (200 OK):
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "employee@example.com",
    "role": "employee"
  }
}
```

**Error Responses**:
- `401 Unauthorized`: Invalid credentials or account is inactive

---

## Attendance Endpoints

### Get Today's Attendance Status

Get today's attendance record and determine which action button to show in the mobile app.

**Endpoint**: `GET /attendance/today`  
**Access**: Employee only

**Response** (200 OK):
```json
{
  "attendance": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "employeeId": "123e4567-e89b-12d3-a456-426614174001",
    "date": "2024-01-15",
    "checkInTime": "2024-01-15T09:00:00.000Z",
    "checkOutTime": null,
    "totalWorkedMinutes": null,
    "shortMinutes": null,
    "salaryEarned": null
  },
  "action": "check-out",
  "message": "You have checked in. You can now check out."
}
```

**Action Values**:
- `"check-in"`: No attendance record exists - show check-in button
- `"check-out"`: Checked in but not checked out - show check-out button
- `"none"`: Both check-in and check-out completed - show no button

**When attendance is null**:
```json
{
  "attendance": null,
  "action": "check-in",
  "message": "No attendance record for today. You can check in."
}
```

---

### Check In

Record employee check-in time for today.

**Endpoint**: `POST /attendance/check-in`  
**Access**: Employee only

**Request Body**:
```json
{
  "checkInDateTime": "2024-01-15T09:00:00.000Z",
  "qrCode": "2024-01-15T09:00:00.000Zsyntax_move"
}
```

**QR Code Format**: Must be `{datetime}syntax_move` (datetime + "syntax_move" suffix)

**Response** (201 Created):
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "employeeId": "123e4567-e89b-12d3-a456-426614174001",
  "date": "2024-01-15",
  "checkInTime": "2024-01-15T09:00:00.000Z",
  "message": "Check-in successful"
}
```

**Error Responses**:
- `400 Bad Request`: Already checked in today, invalid datetime, or invalid QR code
- `403 Forbidden`: Employee access required or account is inactive
- `404 Not Found`: Employee not found

---

### Check Out

Record employee check-out time and calculate salary.

**Endpoint**: `POST /attendance/check-out`  
**Access**: Employee only

**Request Body**:
```json
{
  "checkOutDateTime": "2024-01-15T18:00:00.000Z",
  "qrCode": "2024-01-15T18:00:00.000Zsyntax_move"
}
```

**Response** (201 Created):
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "employeeId": "123e4567-e89b-12d3-a456-426614174001",
  "date": "2024-01-15",
  "checkInTime": "2024-01-15T09:00:00.000Z",
  "checkOutTime": "2024-01-15T18:00:00.000Z",
  "totalWorkedMinutes": 540,
  "shortMinutes": 0,
  "salaryEarned": 1000.0,
  "message": "Check-out successful"
}
```

**Error Responses**:
- `400 Bad Request`: No check-in found, already checked out, invalid QR code, or check-out time must be after check-in time
- `403 Forbidden`: Employee access required or account is inactive
- `404 Not Found`: Employee not found

---

### Get Personal Attendance History

Get authenticated employee's attendance history.

**Endpoint**: `GET /attendance/my-history`  
**Access**: Employee only

**Query Parameters**:
- `startDate` (optional): Start date in `YYYY-MM-DD` format (must be used with `endDate`)
- `endDate` (optional): End date in `YYYY-MM-DD` format (must be used with `startDate`)
- `month` (optional): Month number 1-12 (must be used with `year`)
- `year` (optional): Year e.g., 2024 (must be used with `month`)

**Example Requests**:
```
GET /attendance/my-history?startDate=2024-01-01&endDate=2024-01-31
GET /attendance/my-history?month=1&year=2024
GET /attendance/my-history
```

**Response** (200 OK):
```json
[
  {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "employeeId": "123e4567-e89b-12d3-a456-426614174001",
    "date": "2024-01-15",
    "checkInTime": "2024-01-15T09:00:00.000Z",
    "checkOutTime": "2024-01-15T18:00:00.000Z",
    "totalWorkedMinutes": 540,
    "shortMinutes": 0,
    "salaryEarned": 1000.0,
    "employee": {
      "id": "123e4567-e89b-12d3-a456-426614174001",
      "fullName": "John Doe",
      "designation": "Software Developer"
    }
  }
]
```

**Error Responses**:
- `403 Forbidden`: Employee access required

---

### Get All Attendance Records (Admin)

Get all attendance records in the system. This endpoint is also available at `/admin/attendance` with the same functionality.

**Endpoint**: `GET /attendance`  
**Alternative Endpoint**: `GET /admin/attendance`  
**Access**: Admin only

**Query Parameters**:
- `employeeId` (optional): Filter by employee UUID
- `startDate` (optional): Start date in `YYYY-MM-DD` format
- `endDate` (optional): End date in `YYYY-MM-DD` format

**Example Requests**:
```
GET /attendance
GET /admin/attendance
GET /attendance?employeeId=123e4567-e89b-12d3-a456-426614174001
GET /admin/attendance?startDate=2024-01-01&endDate=2024-01-31
```

**Response** (200 OK):
```json
[
  {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "employeeId": "123e4567-e89b-12d3-a456-426614174001",
    "date": "2024-01-15",
    "checkInTime": "2024-01-15T09:00:00.000Z",
    "checkOutTime": "2024-01-15T18:00:00.000Z",
    "totalWorkedMinutes": 540,
    "shortMinutes": 0,
    "salaryEarned": 1000.0,
    "employee": {
      "id": "123e4567-e89b-12d3-a456-426614174001",
      "fullName": "John Doe",
      "designation": "Software Developer",
      "phone": "+1234567890",
      "user": {
        "id": "123e4567-e89b-12d3-a456-426614174002",
        "email": "john@example.com"
      }
    }
  }
]
```

**Error Responses**:
- `403 Forbidden`: Admin access required

---

### Delete Attendance by ID (Soft Delete)

Delete a specific attendance record using soft delete and automatically update related records.

**Note**: This endpoint performs a soft delete. The attendance record is marked as deleted (deletedAt timestamp is set) but not permanently removed. Deleted attendance records will not appear in queries.

**Endpoint**: `DELETE /attendance/:id`  
**Access**: Admin only

**Path Parameters**:
- `id`: Attendance UUID

**Response** (200 OK):
```json
{
  "message": "Attendance record deleted successfully. Related records updated."
}
```

**What happens when attendance is soft deleted**:
- Attendance record's `deletedAt` field is set to current timestamp
- Monthly attendance summary is recalculated if the attendance had a check-out time
- Deleted attendance records are excluded from all queries
- All related data is updated in a transaction

**Error Responses**:
- `403 Forbidden`: Admin access required
- `404 Not Found`: Attendance record not found

---

### Delete All Attendance Records

Delete all attendance records in the system. **Use with caution!**

**Endpoint**: `DELETE /attendance`  
**Access**: Admin only

**Response** (200 OK):
```json
{
  "message": "All attendance records deleted successfully. Related records updated.",
  "deletedCount": 150
}
```

**What happens when all attendances are deleted**:
- All attendance records are deleted
- All related `SalaryDeductionLedger` entries are automatically deleted (CASCADE)
- All affected monthly attendance summaries are recalculated
- All operations are performed in a transaction

**Error Responses**:
- `403 Forbidden`: Admin access required

---

### Get User Dashboard/Info

Get comprehensive user information including current month stats, missing minutes, working days (excluding public holidays), salary info, and leave requests.

**Endpoint**: `GET /attendance/dashboard`  
**Access**: Employee only

**Response** (200 OK):
```json
{
  "employee": {
    "id": "123e4567-e89b-12d3-a456-426614174001",
    "fullName": "John Doe",
    "designation": "Software Developer",
    "dailySalary": 1000.0,
    "salaryPerHour": 5.05,
    "monthlySalary": 22000.0,
    "status": "full-time",
    "joiningDate": "2024-01-01"
  },
  "currentMonth": {
    "month": 1,
    "year": 2024,
    "totalWorkedMinutes": 16200,
    "totalShortMinutes": 120,
    "missingMinutes": 0,
    "allowedShortMinutes": 600,
    "salaryEarnedThisMonth": 30000.0,
    "totalDeductions": 0.0,
    "netSalary": 30000.0,
    "workingDays": 22,
    "daysWorked": 18,
    "leavesInHours": 2.0,
    "leaveBalance": {
      "totalHours": 15.0,
      "utilizedHours": 2.0,
      "availableHours": 13.0,
      "carryoverHours": 0.0
    },
    "leaveRequests": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174010",
        "date": "2024-01-20",
        "hours": 9,
        "status": "approved",
        "reason": "Personal leave",
        "unpaidHours": 0
      }
    ]
  },
  "totalSalary": 150000.0
}
```

**Response Fields**:
- `employee.dailySalary`: Salary per day
- `employee.salaryPerHour`: Salary per hour (calculated as: monthlySalary / (22 days × 9 hours))
- `employee.monthlySalary`: Monthly salary (calculated as: dailySalary × 22 working days)
- `employee.status`: Employee status (`full-time`, `probation`, or `notice-period`)
- `employee.joiningDate`: Employee's joining date (YYYY-MM-DD format)
- `currentMonth.salaryEarnedThisMonth`: Total salary earned in the current month
- `currentMonth.leavesInHours`: Total leave hours utilized this month
- `missingMinutes`: Number of minutes exceeding the monthly allowance (calculated as `totalShortMinutes - allowedShortMinutes`)
- `allowedShortMinutes`: Monthly short minutes allowance (configurable via `MONTHLY_SHORT_MINUTES_ALLOWED` env variable, default: 600 minutes = 10 hours)
- `workingDays`: Total number of working days in the current month (Monday to Friday, excluding public holidays)
- `daysWorked`: Number of days with completed check-outs in the current month
- `leaveBalance`: Leave balance information for current month
  - `totalHours`: Total leave hours allocated for the month (15 hours)
  - `utilizedHours`: Leave hours already used this month
  - `availableHours`: Remaining leave hours available
  - `carryoverHours`: Leave hours carried over from previous month (max 9 hours)
- `leaveRequests`: Array of leave requests for current month
  - `unpaidHours`: Number of unpaid hours (only present for approved requests with insufficient balance)
- `totalSalary`: Total salary earned across all time

**Working Days Calculation**:
- Working days are calculated as **Monday to Friday** only
- **Public holidays are automatically excluded** from the working days count
- Public holidays are defined in the `public_holidays` table

**Salary Calculations**:
- **Monthly Salary**: `dailySalary × 22` (based on 22 working days per month)
- **Salary Per Hour**: `monthlySalary ÷ (22 × 9)` (22 working days × 9 hours per day)

**Error Responses**:
- `403 Forbidden`: Employee access required
- `404 Not Found`: Employee not found

---

### Process Missing Attendance

Process missing attendance for current month. For each missing working day (Monday-Friday, excluding public holidays), the system first deducts from leave balance, then counts remaining minutes as short minutes if leave is exhausted.

**Endpoint**: `POST /attendance/process-missing`  
**Access**: Admin only

**Query Parameters**:
- `employeeId` (optional): Process for specific employee. If omitted, processes for all employees.

**Example Requests**:
```
POST /attendance/process-missing
POST /attendance/process-missing?employeeId=123e4567-e89b-12d3-a456-426614174000
```

**Response** (200 OK):
```json
{
  "processedDays": 5,
  "leaveDeducted": 1500,
  "shortMinutesAdded": 1200
}
```

**Response Fields**:
- `processedDays`: Number of missing working days processed
- `leaveDeducted`: Total minutes deducted from leave balance
- `shortMinutesAdded`: Total short minutes added (after leave deduction)

**How It Works**:
1. Identifies all working days in the current month (Monday-Friday, excluding public holidays)
2. Filters working days up to today (doesn't process future dates)
3. Finds working days without attendance records
4. For each missing day:
   - **First**: Deducts from leave balance (if available)
     - Full day = 540 minutes (9 hours)
     - Deducts up to available leave balance
   - **Then**: If leave balance is exhausted, counts remaining minutes as short minutes
   - Updates monthly summary with short minutes

**Example**:
- Employee has 300 minutes leave balance
- Missing 1 working day = 540 minutes
- Result: 300 minutes deducted from leave, 240 minutes added to short minutes

**When to Use**:
- Run daily (via scheduled job or manual trigger)
- After adding public holidays
- When you need to recalculate missing attendance

**Important Notes**:
- Only processes dates up to today (future dates are ignored)
- Only processes days that don't have attendance records
- Safe to run multiple times (idempotent)
- Public holidays must be added to `public_holidays` table before processing

**Error Responses**:
- `403 Forbidden`: Admin access required

---

### Request Leave

Submit a leave request for today or a future date. Can be full day (9 hours) or partial (1-9 hours). **Users can request leave even with insufficient or zero leave balance** - excess hours will be marked as unpaid leave if approved.

**Endpoint**: `POST /attendance/leave-request`  
**Access**: Employee only

**Request Body**:
```json
{
  "date": "2024-01-20",
  "hours": 9,
  "reason": "Personal leave"
}
```

**Request Fields**:
- `date` (required): Date in `YYYY-MM-DD` format (must be today or future)
- `hours` (required): Number of hours (1-9). Use 9 for full day leave.
- `reason` (optional): Reason for leave

**Unpaid Leave Support**:
- Users can request leave even with 0 or insufficient leave balance
- No validation error is thrown for insufficient balance
- When approved, available leave balance is deducted first
- Remaining hours are marked as unpaid leave (stored in `unpaidHours` field)
- Unpaid leave creates an attendance record with `unpaidLeave: true`, no check-in/check-out times, and `salaryEarned: 0`

**Response** (201 Created):
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174010",
  "employeeId": "123e4567-e89b-12d3-a456-426614174001",
  "date": "2024-01-20",
  "hours": 9,
  "status": "pending",
  "reason": "Personal leave",
  "message": "Leave request submitted successfully"
}
```

**Error Responses**:
- `400 Bad Request`: Invalid hours (must be 1-9), date in past, or leave/attendance already exists for this date
- `403 Forbidden`: Employee access required or account is inactive
- `404 Not Found`: Employee not found

---

### Get My Leave Requests

Get the authenticated employee's leave requests. Can be filtered by month and year.

**Endpoint**: `GET /attendance/leave-requests`  
**Access**: Employee only

**Query Parameters**:
- `month` (optional): Month number 1-12 (must be used with `year`)
- `year` (optional): Year e.g., 2024 (must be used with `month`)

**Example Requests**:
```
GET /attendance/leave-requests
GET /attendance/leave-requests?month=1&year=2024
```

**Response** (200 OK):
```json
[
  {
    "id": "123e4567-e89b-12d3-a456-426614174010",
    "date": "2024-01-20",
    "hours": 9,
    "status": "pending",
    "reason": "Personal leave",
    "createdAt": "2024-01-15T10:00:00.000Z"
  }
]
```

**Error Responses**:
- `403 Forbidden`: Employee access required

---

## Employee Management

All employee management endpoints require Admin access.

### Get All Employees

**Endpoint**: `GET /employees`  
**Access**: Admin only

**Query Parameters**:
- `search` (optional): Search term to filter by name, email, phone, or designation
- `status` (optional): Filter by employee status - `full-time`, `probation`, or `notice-period`
- `isActive` (optional): Filter by active status - `true` or `false`
- `designation` (optional): Filter by designation (partial match)

**Example Requests**:
```
GET /employees
GET /employees?search=john
GET /employees?status=full-time&isActive=true
GET /employees?search=developer&designation=Software
GET /employees?status=probation&isActive=false
```

**Response** (200 OK):
```json
[
  {
    "id": "123e4567-e89b-12d3-a456-426614174001",
    "userId": "123e4567-e89b-12d3-a456-426614174002",
    "fullName": "John Doe",
    "phone": "+1234567890",
    "designation": "Software Developer",
    "dailySalary": 1000.0,
    "joiningDate": "2024-01-01",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "user": {
      "id": "123e4567-e89b-12d3-a456-426614174002",
      "email": "john@example.com",
      "role": "employee",
      "isActive": true
    }
  }
]
```

---

### Get Employee by ID

**Endpoint**: `GET /employees/:id`  
**Access**: Admin only

**Path Parameters**:
- `id`: Employee UUID

**Response** (200 OK):
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174001",
  "userId": "123e4567-e89b-12d3-a456-426614174002",
  "fullName": "John Doe",
  "phone": "+1234567890",
  "designation": "Software Developer",
  "dailySalary": 1000.0,
  "joiningDate": "2024-01-01",
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174002",
    "email": "john@example.com",
    "role": "employee",
    "isActive": true
  }
}
```

**Error Responses**:
- `403 Forbidden`: Admin access required
- `404 Not Found`: Employee not found

---

### Create Employee

Create a new employee account along with an associated user account.

**Endpoint**: `POST /employees`  
**Access**: Admin only

**Request Body**:
```json
{
  "email": "john@example.com",
  "password": "securePassword123",
  "role": "employee",
  "fullName": "John Doe",
  "phone": "+1234567890",
  "designation": "Software Developer",
  "monthlySalary": 22000.0,
  "joiningDate": "2024-01-01",
  "status": "full-time"
}
```

**Request Fields**:
- `monthlySalary` (required): Monthly salary amount. Daily salary will be automatically calculated based on working days (21-23 days) in the joining month.

**Request Fields**:
- `status` (optional): Employee status - `full-time` (default), `probation`, or `notice-period`

**Response** (201 Created):
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174001",
  "userId": "123e4567-e89b-12d3-a456-426614174002",
  "fullName": "John Doe",
  "phone": "+1234567890",
  "designation": "Software Developer",
  "dailySalary": 1000.0,
  "joiningDate": "2024-01-01",
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174002",
    "email": "john@example.com",
    "role": "employee",
    "isActive": true
  }
}
```

**Error Responses**:
- `400 Bad Request`: Validation error or email already exists
- `403 Forbidden`: Admin access required

---

### Update Employee

Update employee information. All fields are optional.

**Endpoint**: `PATCH /employees/:id`  
**Access**: Admin only

**Path Parameters**:
- `id`: Employee UUID

**Request Body** (all fields optional):
```json
{
  "fullName": "John Updated",
  "phone": "+9876543210",
  "designation": "Senior Developer",
  "dailySalary": 1500.0,
  "joiningDate": "2024-01-01",
  "status": "full-time",
  "isActive": true
}
```

**Request Fields**:
- `status` (optional): Employee status - `full-time`, `probation`, or `notice-period`

**Note**: If `isActive` is provided, it will update the associated user account's `isActive` status.

**Response** (200 OK):
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174001",
  "fullName": "John Updated",
  "phone": "+9876543210",
  "designation": "Senior Developer",
  "dailySalary": 1500.0,
  "joiningDate": "2024-01-01",
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174002",
    "email": "john@example.com",
    "role": "employee",
    "isActive": true
  }
}
```

**Error Responses**:
- `403 Forbidden`: Admin access required
- `404 Not Found`: Employee not found

---

### Deactivate Employee

Deactivate an employee by setting their user account's `isActive` to false.

**Endpoint**: `PATCH /employees/:id/deactivate`  
**Access**: Admin only

**Path Parameters**:
- `id`: Employee UUID

**Response** (200 OK):
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174001",
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174002",
    "email": "john@example.com",
    "isActive": false
  }
}
```

**Error Responses**:
- `403 Forbidden`: Admin access required
- `404 Not Found`: Employee not found

---

## Admin Endpoints

All admin endpoints require Admin access.

### Create User

Create a new user account (admin or employee).

**Endpoint**: `POST /admin/users`  
**Access**: Admin only

**Request Body**:
```json
{
  "email": "newuser@example.com",
  "password": "securePassword123",
  "role": "employee"
}
```

**Response** (201 Created):
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "email": "newuser@example.com",
  "role": "employee",
  "isActive": true,
  "createdAt": "2024-01-15T00:00:00.000Z",
  "updatedAt": "2024-01-15T00:00:00.000Z"
}
```

**Error Responses**:
- `400 Bad Request`: Validation error or email already exists
- `403 Forbidden`: Admin access required

---

### Get Monthly Salary Report

Get comprehensive monthly salary report for all employees.

**Endpoint**: `GET /admin/salary/monthly`  
**Access**: Admin only

**Query Parameters**:
- `month` (required): Month number 1-12
- `year` (required): Year e.g., 2024

**Example Request**:
```
GET /admin/salary/monthly?month=1&year=2024
```

**Response** (200 OK):
```json
[
  {
    "employeeId": "123e4567-e89b-12d3-a456-426614174001",
    "employeeName": "John Doe",
    "totalWorkedMinutes": 16200,
    "totalShortMinutes": 0,
    "totalSalaryEarned": 30000.0,
    "totalDeductions": 0.0,
    "netSalary": 30000.0
  }
]
```

**Error Responses**:
- `403 Forbidden`: Admin access required

---

### Get Employee Salary Report

Get detailed salary report for a specific employee.

**Endpoint**: `GET /admin/salary/employee/:id`  
**Access**: Admin only

**Path Parameters**:
- `id`: Employee UUID

**Query Parameters**:
- `month` (optional): Month number 1-12
- `year` (optional): Year e.g., 2024

**Note**: If month and year are not provided, returns all-time data.

**Example Requests**:
```
GET /admin/salary/employee/123e4567-e89b-12d3-a456-426614174001?month=1&year=2024
GET /admin/salary/employee/123e4567-e89b-12d3-a456-426614174001
```

**Response** (200 OK):
```json
{
  "employee": {
    "id": "123e4567-e89b-12d3-a456-426614174001",
    "fullName": "John Doe",
    "email": "john@example.com"
  },
  "totalSalary": 30000.0,
  "totalDeductions": 500.0,
  "netSalary": 29500.0,
  "attendances": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "date": "2024-01-15",
      "checkInTime": "2024-01-15T09:00:00.000Z",
      "checkOutTime": "2024-01-15T18:00:00.000Z",
      "totalWorkedMinutes": 540,
      "shortMinutes": 0,
      "salaryEarned": 1000.0
    }
  ],
  "deductions": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174003",
      "deductedMinutes": 30,
      "deductedAmount": 500.0,
      "reason": "Short hours deduction for 2024-01-20",
      "createdAt": "2024-01-20T18:00:00.000Z"
    }
  ]
}
```

**Error Responses**:
- `400 Bad Request`: Employee not found
- `403 Forbidden`: Admin access required

---

### Get All Attendance Records (Admin)

Get all attendance records with optional filters for employee and date range.

**Endpoint**: `GET /admin/attendance`  
**Access**: Admin only

**Query Parameters**:
- `employeeId` (optional): Filter by employee UUID
- `startDate` (optional): Start date in `YYYY-MM-DD` format
- `endDate` (optional): End date in `YYYY-MM-DD` format

**Example Requests**:
```
GET /admin/attendance
GET /admin/attendance?employeeId=123e4567-e89b-12d3-a456-426614174001
GET /admin/attendance?startDate=2024-01-01&endDate=2024-01-31
GET /admin/attendance?employeeId=123e4567-e89b-12d3-a456-426614174001&startDate=2024-01-01&endDate=2024-01-31
```

**Response** (200 OK):
```json
[
  {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "employeeId": "123e4567-e89b-12d3-a456-426614174001",
    "date": "2024-01-15",
    "checkInTime": "2024-01-15T09:00:00.000Z",
    "checkOutTime": "2024-01-15T18:00:00.000Z",
    "totalWorkedMinutes": 540,
    "shortMinutes": 0,
    "salaryEarned": 1000.0,
    "employee": {
      "id": "123e4567-e89b-12d3-a456-426614174001",
      "fullName": "John Doe",
      "designation": "Software Developer",
      "phone": "+1234567890",
      "user": {
        "id": "123e4567-e89b-12d3-a456-426614174002",
        "email": "john@example.com"
      }
    }
  }
]
```

**Error Responses**:
- `403 Forbidden`: Admin access required

---

### Get All Leave Requests (Admin)

Get all leave requests with optional filters for employee and status.

**Endpoint**: `GET /admin/leave-requests`  
**Access**: Admin only

**Query Parameters**:
- `employeeId` (optional): Filter by employee UUID
- `status` (optional): Filter by status - `pending`, `approved`, or `rejected`

**Example Requests**:
```
GET /admin/leave-requests
GET /admin/leave-requests?status=pending
GET /admin/leave-requests?employeeId=123e4567-e89b-12d3-a456-426614174001
GET /admin/leave-requests?employeeId=123e4567-e89b-12d3-a456-426614174001&status=approved
```

**Response** (200 OK):
```json
[
  {
    "id": "123e4567-e89b-12d3-a456-426614174010",
    "employeeId": "123e4567-e89b-12d3-a456-426614174001",
    "employee": {
      "id": "123e4567-e89b-12d3-a456-426614174001",
      "fullName": "John Doe",
      "email": "john@example.com"
    },
    "date": "2024-01-20",
    "hours": 9,
    "status": "pending",
    "reason": "Personal leave",
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z"
  }
]
```

**Error Responses**:
- `403 Forbidden`: Admin access required

---

### Approve Leave Request (Admin)

Approve a leave request. If leave balance is sufficient, deducts from balance. If insufficient, deducts available balance and marks remaining hours as unpaid leave. Creates attendance record for unpaid leave.

**Endpoint**: `PATCH /admin/leave-requests/:id/approve`  
**Access**: Admin only

**Path Parameters**:
- `id`: Leave request UUID

**Response** (200 OK):
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174010",
  "status": "approved",
  "paidHours": 3.0,
  "unpaidHours": 6,
  "message": "Leave request approved. 3.0 hours deducted from leave balance, 6 hours marked as unpaid leave."
}
```

**Response Fields**:
- `paidHours`: Number of hours deducted from leave balance (decimal, e.g., 3.0)
- `unpaidHours`: Number of unpaid hours (integer, 0 if balance was sufficient)
- `message`: Human-readable message explaining the approval result

**What happens when leave is approved**:

**Scenario 1: Sufficient Leave Balance**
- Leave request status is updated to `approved`
- All requested hours are deducted from employee's leave balance
- `unpaidHours: 0`
- No attendance record is created

**Scenario 2: Insufficient Leave Balance**
- Leave request status is updated to `approved`
- Available leave balance is deducted first
- Remaining hours are stored in `unpaidHours` field
- An attendance record is created with:
  - `checkInTime`: null
  - `checkOutTime`: null
  - `unpaidLeave`: true
  - `totalWorkedMinutes`: 0
  - `shortMinutes`: unpaid minutes (e.g., 540 for full day)
  - `salaryEarned`: 0

**Error Responses**:
- `400 Bad Request`: Leave request already processed or attendance record already exists for this date
- `403 Forbidden`: Admin access required
- `404 Not Found`: Leave request not found

---

### Reject Leave Request (Admin)

Reject a leave request.

**Endpoint**: `PATCH /admin/leave-requests/:id/reject`  
**Access**: Admin only

**Path Parameters**:
- `id`: Leave request UUID

**Response** (200 OK):
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174010",
  "status": "rejected",
  "message": "Leave request rejected"
}
```

**Error Responses**:
- `400 Bad Request`: Leave request already processed
- `403 Forbidden`: Admin access required
- `404 Not Found`: Leave request not found

---

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": "Error message describing what went wrong",
  "error": "Bad Request"
}
```

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Invalid credentials",
  "error": "Unauthorized"
}
```

### 403 Forbidden
```json
{
  "statusCode": 403,
  "message": "Admin access required",
  "error": "Forbidden"
}
```

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Resource not found",
  "error": "Not Found"
}
```

### 500 Internal Server Error
```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "error": "Internal Server Error"
}
```

---

## Data Models

### User
```typescript
{
  id: string;              // UUID
  email: string;          // Unique
  passwordHash: string;   // Hashed password (not returned in responses)
  role: 'admin' | 'employee';
  isActive: boolean;      // Default: true
  deletedAt: Date | null; // Soft delete timestamp (null if not deleted)
  createdAt: Date;
  updatedAt: Date;
}
```

### Employee
```typescript
{
  id: string;             // UUID
  userId: string;         // Foreign key to User (1:1 relationship)
  fullName: string;
  phone: string;
  designation: string;
  dailySalary: number;     // Decimal(10, 2) - Calculated from monthlySalary
  joiningDate: Date;      // DATEONLY
  status: 'full-time' | 'probation' | 'notice-period';  // Default: 'full-time'
  deletedAt: Date | null; // Soft delete timestamp (null if not deleted)
  createdAt: Date;
  updatedAt: Date;
}
```

### Attendance
```typescript
{
  id: string;                    // UUID
  employeeId: string;            // Foreign key to Employee
  date: Date;                    // DATEONLY, unique with employeeId
  checkInTime: Date | null;      // Nullable
  checkOutTime: Date | null;     // Nullable
  totalWorkedMinutes: number | null;
  shortMinutes: number | null;
  salaryEarned: number | null;   // Decimal(10, 2)
  unpaidLeave: boolean;          // True if this is an unpaid leave day (no check-in/check-out)
  deletedAt: Date | null;        // Soft delete timestamp (null if not deleted)
  createdAt: Date;
  updatedAt: Date;
}
```

**Unpaid Leave Records**:
- `unpaidLeave: true` indicates an unpaid leave day
- For unpaid leave: `checkInTime` and `checkOutTime` are null, `totalWorkedMinutes: 0`, `salaryEarned: 0`
- `shortMinutes` contains the unpaid minutes (e.g., 540 for full day)
- Created when a leave request is approved with insufficient balance

### MonthlyAttendanceSummary
```typescript
{
  id: string;
  employeeId: string;
  month: number;                 // 1-12
  year: number;
  totalWorkedMinutes: number;
  totalShortMinutes: number;
  totalSalaryEarned: number;      // Decimal(10, 2)
  createdAt: Date;
  updatedAt: Date;
}
```

### SalaryDeductionLedger
```typescript
{
  id: string;
  employeeId: string;
  attendanceId: string | null;   // Nullable
  deductedMinutes: number;
  deductedAmount: number;        // Decimal(10, 2)
  reason: string | null;         // Nullable
  createdAt: Date;
}
```

### LeaveRequest
```typescript
{
  id: string;
  employeeId: string;
  date: Date;                    // DATEONLY, unique with employeeId
  hours: number;                  // 1-9 hours
  status: 'pending' | 'approved' | 'rejected';
  reason: string | null;         // Nullable
  unpaidHours: number;           // Number of unpaid hours (when leave balance is insufficient)
  createdAt: Date;
  updatedAt: Date;
}
```

**Unpaid Hours Field**:
- `unpaidHours`: Number of unpaid hours when leave balance is insufficient
- Only set for approved requests
- If `unpaidHours > 0`, an attendance record is created with `unpaidLeave: true`
- Example: Request 9 hours with 3 hours balance → `unpaidHours: 6`

### LeaveBalance
```typescript
{
  id: string;
  employeeId: string;
  month: number;                 // 1-12
  year: number;
  balanceMinutes: number;       // Total leave balance in minutes (15 hours = 900 minutes per month)
  utilizedMinutes: number;       // Leave utilized in minutes this month
  carryoverMinutes: number;      // Carryover from previous month (max 9 hours = 540 minutes)
  createdAt: Date;
  updatedAt: Date;
}
```

### PublicHoliday
```typescript
{
  id: string;
  date: Date;                    // DATEONLY, unique
  name: string;                  // Name/description of the holiday
  description: string | null;    // Optional additional notes
  createdAt: Date;
  updatedAt: Date;
}
```

**Public Holidays**:
- Public holidays are stored in the `public_holidays` table
- Used to exclude holidays from working days calculation
- Must be added before processing missing attendance
- Dates are unique (one holiday per date)

---

## Business Rules

### Working Hours
- **Official working hours**: 12:00 PM PKT – 9:00 PM PKT
- **Total required per day**: 9 hours (540 minutes)
- Employee can check in **once** and check out **once** per day

### Working Days System
- **Working Days Definition**: Monday to Friday, excluding public holidays
- **Public Holidays**: Stored in `public_holidays` table, automatically excluded from working days count
- **Independent Calculation**: Working days are calculated independently of attendance records
- **Missing Attendance Processing**: 
  - Missing attendance on working days automatically deducts from leave balance first
  - After leave balance is exhausted, remaining minutes are counted as short minutes
  - Full missing day = 540 minutes (9 hours)
- **Process Missing Attendance**: Use `POST /attendance/process-missing` to process missing days (admin only)

### Salary Calculation
- Salary is calculated **per day**
- Employee has a **daily salary rate**
- **Short time** = worked hours < 9 hours
- **Leave balance is considered first**: Short minutes are covered by available leave balance before deductions
- **Monthly short time allowance**: Configurable via `MONTHLY_SHORT_MINUTES_ALLOWED` environment variable (in minutes)
- **Default**: 10 hours (600 minutes) if not set in environment
- **Deduction calculation**:
  1. Short minutes are first covered by available leave balance
  2. Remaining short minutes after using leave balance are compared to monthly allowance
  3. If remaining short minutes ≤ allowance → **no deduction**
  4. If remaining short minutes > allowance → deduction starts **per minute** beyond allowance

### QR Code Validation
- QR code format: `{datetime}syntax_move`
- Example: `2024-01-15T09:00:00.000Zsyntax_move`
- QR code must match the provided datetime
- QR code must end with `syntax_move`

### Attendance Rules
- One attendance record per employee per day
- Check-in must occur before check-out
- Check-out time must be after check-in time
- Cannot check in twice in the same day
- Cannot check out without checking in first
- Cannot check out twice in the same day

### Leave Balance System
- **Monthly leave allocation**: **15 hours (900 minutes)** per month
- **Leave carryover**: Maximum **9 hours (540 minutes)** can be carried over to the next month
- **Leave utilization**: Leave can be utilized in two ways:
  1. **Short working hours**: When employee works less than 9 hours (coming late or going early), short minutes are automatically deducted from leave balance
  2. **Approved leave requests**: When admin approves a leave request, the requested hours are deducted from leave balance
- **Joining date logic**: Employee's joining date is considered as the **first day of the month** for that employee. Full month's leave (15 hours) is allocated for the joining month.
- **Leave balance initialization**: Leave balance is automatically initialized when an employee is created
- **Carryover calculation**: At the start of each month, unused leave balance from previous month is carried over (max 9 hours). Any excess is wasted.

### Leave Request Rules
- Leave can only be requested for **today or future dates**
- Leave hours must be between **1 and 9** (9 hours = full day)
- **One leave request per employee per day**
- Cannot request leave if attendance already exists for that date
- Leave requests are created with **pending** status by default
- **Unpaid Leave Support**: Users can request leave even with 0 or insufficient balance
  - No validation error is thrown for insufficient balance
  - When approved, available balance is deducted first
  - Remaining hours are marked as unpaid leave (`unpaidHours` field)
  - Unpaid leave creates an attendance record with `unpaidLeave: true`
- Working days are calculated as **Monday to Friday** only (excluding public holidays)

### Employee Status
- **full-time**: Regular full-time employee (default)
- **probation**: Employee on probation period
- **notice-period**: Employee in notice period

### Cascade Delete Rules
When attendance records are deleted, the following cascade operations occur:
- **SalaryDeductionLedger**: All entries linked to the deleted attendance are automatically deleted
- **MonthlyAttendanceSummary**: Automatically recalculated to reflect the removal of the attendance data

When an employee is deleted, the following cascade operations occur:
- **User account**: Associated user account is automatically deleted
- **Attendance records**: All attendance records are automatically deleted
- **Leave requests**: All leave requests are automatically deleted
- **Leave balance**: All leave balance records are automatically deleted
- **Monthly attendance summaries**: All monthly summaries are automatically deleted
- **Salary deduction ledgers**: All deduction ledger entries are automatically deleted

---

## Authentication Flow

1. **Login**: `POST /auth/login` with email and password
   - System checks if user exists, is active, and is not deleted (deletedAt is null)
   - Deleted users cannot login even if credentials are correct
2. **Receive Token**: Get JWT access token from response
3. **Use Token**: Include token in Authorization header for all protected endpoints
   ```
   Authorization: Bearer <your-token-here>
   ```
4. **Token Expiry**: Tokens expire after 24 hours (configurable via `JWT_EXPIRES_IN`)

## Soft Delete System

The system implements soft delete for Users, Employees, and Attendance records:

- **Soft Delete**: Records are marked as deleted by setting `deletedAt` timestamp instead of being permanently removed
- **Query Filtering**: All queries automatically exclude records where `deletedAt` is not null
- **Login Protection**: Deleted users cannot login (login endpoint checks for deletedAt)
- **Cascade Behavior**: When an employee is soft deleted, the associated user account is also soft deleted
- **Data Integrity**: Related records (attendance, leave requests, etc.) remain in database but are effectively hidden
- **Recovery**: Soft deleted records can potentially be recovered by setting `deletedAt` back to null (not exposed via API)

---

## Rate Limiting

Currently, there is no rate limiting implemented. Consider implementing rate limiting for production environments.

---

## CORS

CORS is enabled for all origins. Configure CORS settings in production to restrict allowed origins.

---

## Swagger UI

Interactive API documentation is available at:
- **URL**: `http://localhost:3000/docs`
- **Features**:
  - Try out endpoints directly
  - View request/response schemas
  - Authenticate with JWT token
  - See all available endpoints

---

## Support

For issues or questions, please refer to the project repository or contact the development team.

---

## Environment Variables

### MONTHLY_SHORT_MINUTES_ALLOWED
- **Description**: Monthly short minutes allowance (in minutes)
- **Default**: 600 (10 hours)
- **Example**: Set to `900` for 15 hours allowance
- **Usage**: Used in salary calculation to determine when deductions start

---

**Last Updated**: 2024-01-24  
**API Version**: 1.3

## Version 1.3 Changes

- **Working Days System**: Working days calculated independently of attendance (Monday-Friday, excluding public holidays)
- **Public Holidays Support**: Public holidays table and automatic exclusion from working days count
- **Missing Attendance Processing**: Automatic leave deduction and short minutes calculation for missing working days
- **Unpaid Leave Support**: Users can request leave with insufficient balance; excess hours marked as unpaid leave
- **Unpaid Leave Attendance Records**: Attendance records created for unpaid leave with `unpaidLeave: true`
- **Updated Leave Request Model**: Added `unpaidHours` field to track unpaid hours
- **Updated Attendance Model**: Added `unpaidLeave` field to identify unpaid leave days
- **Process Missing Attendance Endpoint**: New admin endpoint to process missing attendance for current month

## Version 1.2 Changes

- **Soft Delete Implementation**: Added soft delete support for Users, Employees, and Attendance records
- **Monthly Salary Input**: Changed employee creation to accept `monthlySalary` instead of `dailySalary`
- **Automatic Daily Salary Calculation**: Daily salary is now calculated from monthly salary based on working days (21-23 days/month)
- **Enhanced Query Filtering**: All queries now automatically exclude soft-deleted records
- **Login Security**: Login endpoint now checks for deleted users and prevents login

