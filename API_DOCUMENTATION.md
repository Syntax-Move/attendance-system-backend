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

Get all attendance records in the system.

**Endpoint**: `GET /attendance`  
**Access**: Admin only

**Query Parameters**:
- `employeeId` (optional): Filter by employee UUID
- `startDate` (optional): Start date in `YYYY-MM-DD` format (must be used with `endDate`)
- `endDate` (optional): End date in `YYYY-MM-DD` format (must be used with `startDate`)

**Example Requests**:
```
GET /attendance
GET /attendance?employeeId=123e4567-e89b-12d3-a456-426614174001
GET /attendance?startDate=2024-01-01&endDate=2024-01-31
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

### Delete Attendance by ID

Delete a specific attendance record and automatically update related records.

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

**What happens when attendance is deleted**:
- Related `SalaryDeductionLedger` entries are automatically deleted (CASCADE)
- Monthly attendance summary is recalculated if the attendance had a check-out time
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

## Employee Management

All employee management endpoints require Admin access.

### Get All Employees

**Endpoint**: `GET /employees`  
**Access**: Admin only

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
  "dailySalary": 1000.0,
  "joiningDate": "2024-01-01"
}
```

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
  "isActive": true
}
```

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
  dailySalary: number;     // Decimal(10, 2)
  joiningDate: Date;      // DATEONLY
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
  createdAt: Date;
  updatedAt: Date;
}
```

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

---

## Business Rules

### Working Hours
- **Official working hours**: 12:00 PM PKT – 9:00 PM PKT
- **Total required per day**: 9 hours (540 minutes)
- Employee can check in **once** and check out **once** per day

### Salary Calculation
- Salary is calculated **per day**
- Employee has a **daily salary rate**
- **Short time** = worked hours < 9 hours
- **Monthly short time allowance**: **6 hours total (360 minutes)**
- If total short hours ≤ 6 hours → **no deduction**
- If total short hours > 6 hours → deduction starts **per minute** beyond 6 hours

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

### Cascade Delete Rules
When attendance records are deleted, the following cascade operations occur:
- **SalaryDeductionLedger**: All entries linked to the deleted attendance are automatically deleted
- **MonthlyAttendanceSummary**: Automatically recalculated to reflect the removal of the attendance data
- **Employee deletion**: When an employee is deleted, all their attendance records, monthly summaries, and deduction ledgers are automatically deleted

---

## Authentication Flow

1. **Login**: `POST /auth/login` with email and password
2. **Receive Token**: Get JWT access token from response
3. **Use Token**: Include token in Authorization header for all protected endpoints
   ```
   Authorization: Bearer <your-token-here>
   ```
4. **Token Expiry**: Tokens expire after 24 hours (configurable via `JWT_EXPIRES_IN`)

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

**Last Updated**: 2024-01-15  
**API Version**: 1.0

