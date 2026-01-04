# Setup Guide

## Prerequisites

1. **Node.js** (v18 or higher)
2. **PostgreSQL** (v12 or higher)
3. **npm** or **yarn**

## Installation Steps

### 1. Install Dependencies

```bash
cd attendance-system-backend
npm install
```

### 2. Database Setup

Create a PostgreSQL database:

```sql
CREATE DATABASE attendance_system;
```

### 3. Environment Configuration

Create a `.env` file in the `attendance-system-backend` directory:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_postgres_password
DB_NAME=attendance_system

# SSL Configuration (for remote databases like Aiven, AWS RDS, etc.)
# Set DB_SSL=true if your database requires SSL connection
DB_SSL=false
DB_SSL_REJECT_UNAUTHORIZED=true

# JWT Configuration
JWT_SECRET=your-secret-key-change-in-production-min-32-chars
JWT_EXPIRES_IN=24h

# Server Configuration
PORT=3000
NODE_ENV=development

# Admin User Seed (Optional - defaults shown)
# The first admin user will be created automatically on first run
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=admin123
```

**Important**: 
- Change `JWT_SECRET` to a strong, random string in production!
- Change `ADMIN_EMAIL` and `ADMIN_PASSWORD` in production!

### 4. Run the Application

```bash
# Development mode (with hot reload)
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

The application will start on `http://localhost:3000` (or the port specified in `.env`).

### 5. Database Tables

The tables will be automatically created on first run (if `NODE_ENV !== 'production'`). The following tables will be created:

- `users` - User authentication and roles
- `employees` - Employee information
- `attendances` - Daily attendance records
- `monthly_attendance_summaries` - Monthly aggregated data
- `salary_deduction_ledgers` - Salary deduction audit trail

## Creating First Admin User

**The first admin user is created automatically when you start the application for the first time!**

The seed script will:
- Check if an admin user already exists
- Create a default admin user if none exists
- Use credentials from `.env` file or defaults:
  - Email: `admin@example.com` (or `ADMIN_EMAIL` from `.env`)
  - Password: `admin123` (or `ADMIN_PASSWORD` from `.env`)

**⚠️ Important**: Change the default admin credentials in production by setting `ADMIN_EMAIL` and `ADMIN_PASSWORD` in your `.env` file!

After the first run, you'll see a log message:
```
[CreateAdminUserSeed] Admin user created successfully with email: admin@example.com
⚠️  IMPORTANT: Change the default admin password in production!
```

You can then login with these credentials at `POST /auth/login`.

## API Testing

Once the server is running, you can test the API endpoints:

### Login
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'
```

### Create Employee (Admin only)
```bash
curl -X POST http://localhost:3000/admin/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "email": "employee@example.com",
    "password": "password123",
    "role": "employee",
    "fullName": "John Doe",
    "phone": "+1234567890",
    "designation": "Developer",
    "dailySalary": 1000,
    "joiningDate": "2024-01-01"
  }'
```

## Troubleshooting

### Database Connection Issues

- Ensure PostgreSQL is running
- Check database credentials in `.env`
- Verify database exists: `psql -U postgres -l`

### Port Already in Use

Change the `PORT` in `.env` or kill the process using port 3000.

### Module Not Found Errors

Run `npm install` again to ensure all dependencies are installed.

### Sequelize Errors

- Ensure PostgreSQL is running
- Check database connection string
- Verify all models are properly exported

## Next Steps

1. Create your first admin user
2. Create employee accounts via the admin API
3. Test check-in/check-out functionality
4. Review salary calculation logic
5. Set up production environment variables

