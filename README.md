# Attendance System Backend

A comprehensive NestJS backend for an employee attendance and salary management system.

## Features

- **JWT Authentication** - Secure token-based authentication
- **Role-Based Access Control** - Admin and Employee roles
- **Attendance Tracking** - Check-in/Check-out with automatic calculation
- **Salary Calculation** - Automatic salary calculation with monthly short-hour allowance
- **Admin Dashboard APIs** - User management, employee management, and reporting

## Tech Stack

- **Framework**: NestJS
- **ORM**: Sequelize with TypeScript decorators
- **Database**: PostgreSQL
- **Authentication**: JWT (Passport)
- **Validation**: class-validator, class-transformer

## Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the root directory:
```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=attendance_system

# SSL Configuration (for remote databases)
DB_SSL=false
DB_SSL_REJECT_UNAUTHORIZED=true

# JWT Configuration
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=24h

# Server Configuration
PORT=3000
NODE_ENV=development

# Admin User Seed (Optional - defaults shown)
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=admin123
```

3. Create the PostgreSQL database:
```sql
CREATE DATABASE attendance_system;
```

4. Run the application:
```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

## API Documentation

Swagger documentation is available at `/docs` when the server is running.

Access it at: `http://localhost:3000/docs`

The Swagger UI provides:
- Interactive API testing
- Request/response schemas
- Authentication support (JWT Bearer token)
- All endpoint documentation

## API Endpoints

### Authentication

- `POST /auth/login` - Login and get JWT token

### Employee Endpoints (Protected - Employee Role)

- `POST /attendance/check-in` - Check in for the day
- `POST /attendance/check-out` - Check out and calculate salary
- `GET /attendance/my-history` - Get personal attendance history
  - Query params: `startDate`, `endDate`, `month`, `year`

### Admin Endpoints (Protected - Admin Role)

#### User Management
- `POST /admin/users` - Create new user (admin or employee)

#### Employee Management
- `GET /employees` - Get all employees
- `GET /employees/:id` - Get employee by ID
- `POST /employees` - Create new employee
- `PATCH /employees/:id` - Update employee
- `PATCH /employees/:id/deactivate` - Deactivate employee

#### Attendance Management
- `GET /attendance` - Get all attendance records
  - Query params: `employeeId`, `startDate`, `endDate`

#### Salary Reports
- `GET /admin/salary/monthly?month=1&year=2024` - Get monthly salary report
- `GET /admin/salary/employee/:id?month=1&year=2024` - Get employee salary report

## Business Rules

### Working Hours
- Official working hours: **12:00 PM PKT – 9:00 PM PKT**
- Total required per day: **9 hours (540 minutes)**
- Employee can check in once and check out once per day

### Salary Calculation
- Salary is calculated **per day**
- Employee has a **daily salary rate**
- **Short time** = worked hours < 9 hours
- **Monthly short time allowance**: **6 hours total (360 minutes)**
- If total short hours ≤ 6 hours → **no deduction**
- If total short hours > 6 hours → deduction starts **per minute** beyond 6 hours

## Database Schema

### Users
- Stores authentication and role information

### Employees
- Stores employee-specific information (1:1 with User)

### Attendance
- Stores daily attendance records
- Unique constraint: (employeeId, date)

### MonthlyAttendanceSummary
- Aggregated monthly attendance data for performance

### SalaryDeductionLedger
- Audit trail for salary deductions

## Security

- Passwords are hashed using bcrypt
- JWT tokens for authentication
- Role-based guards for route protection
- Input validation using class-validator

## Development

```bash
# Watch mode
npm run start:dev

# Build
npm run build

# Run tests
npm run test

# Lint
npm run lint
```

## License

Private - UNLICENSED
