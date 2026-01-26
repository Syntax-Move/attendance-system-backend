# Environment Configuration Guide

This guide explains how to configure different environments for the Attendance System Backend.

## Environment File Structure

The application supports environment-specific configuration files that are automatically loaded based on `NODE_ENV`:

### File Loading Priority

The application loads environment files in the following order (first found wins):

1. `.env.${NODE_ENV}.local` (e.g., `.env.development.local`) - Local overrides
2. `.env.${NODE_ENV}` (e.g., `.env.development`) - Environment-specific
3. `.env.local` - Local overrides (ignored by git)
4. `.env` - Default fallback

### Supported Environments

- **development** - Default for local development
- **production** - For production deployments
- **test** - For running tests

## Setup Instructions

### 1. Development Environment

Create `.env.development` file:

```env
# Environment
NODE_ENV=development

# Server Configuration
PORT=3000

# Database Configuration (Local Development)
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=29011999
DB_NAME=attendance_system_dev

# SSL Configuration (usually false for local)
DB_SSL=false
DB_SSL_REJECT_UNAUTHORIZED=true

# JWT Configuration
JWT_SECRET=development-secret-key-change-in-production-min-32-chars
JWT_EXPIRES_IN=24h

# Admin User Seed
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=admin123
```

### 2. Production Environment

Create `.env.production` file:

```env
# Environment
NODE_ENV=production

# Server Configuration
PORT=3000

# Database Configuration (Production)
DB_HOST=your-production-db-host
DB_PORT=5432
DB_USERNAME=your-production-db-username
DB_PASSWORD=your-production-db-password
DB_NAME=attendance_system_prod

# SSL Configuration (usually true for production)
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=true

# JWT Configuration
# CRITICAL: Use a strong, random secret key (minimum 32 characters)
# Generate with: openssl rand -base64 32
JWT_SECRET=CHANGE-THIS-TO-A-STRONG-RANDOM-SECRET-MIN-32-CHARS
JWT_EXPIRES_IN=24h

# Admin User Seed
ADMIN_EMAIL=admin@yourcompany.com
ADMIN_PASSWORD=CHANGE-THIS-TO-A-STRONG-PASSWORD
```

### 3. Test Environment

Create `.env.test` file:

```env
# Environment
NODE_ENV=test

# Server Configuration
PORT=3001

# Database Configuration (Test Database)
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_postgres_password
DB_NAME=attendance_system_test

# SSL Configuration (usually false for local test)
DB_SSL=false
DB_SSL_REJECT_UNAUTHORIZED=true

# JWT Configuration
JWT_SECRET=test-secret-key-for-testing-only
JWT_EXPIRES_IN=1h

# Admin User Seed
ADMIN_EMAIL=test-admin@example.com
ADMIN_PASSWORD=test123
```

### 4. Base Configuration (Fallback)

Create `.env` file as fallback:

```env
# Environment Configuration
NODE_ENV=development

# Server Configuration
PORT=3000

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_postgres_password
DB_NAME=attendance_system

# SSL Configuration
DB_SSL=false
DB_SSL_REJECT_UNAUTHORIZED=true

# JWT Configuration
JWT_SECRET=your-secret-key-change-in-production-min-32-chars
JWT_EXPIRES_IN=24h

# Admin User Seed
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=admin123
```

## Running with Different Environments

### Development (Default)
```bash
npm run start:dev
# or explicitly
NODE_ENV=development npm run start:dev
```

### Production
```bash
npm run build
NODE_ENV=production npm run start:prod
```

### Test
```bash
NODE_ENV=test npm run start:test
```

## Environment Variables Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development`, `production`, `test` |
| `DB_HOST` | Database host | `localhost` or `your-db-host.com` |
| `DB_PORT` | Database port | `5432` |
| `DB_USERNAME` | Database username | `postgres` |
| `DB_PASSWORD` | Database password | `your_password` |
| `DB_NAME` | Database name | `attendance_system` |
| `JWT_SECRET` | JWT signing secret | `your-secret-key-min-32-chars` |

### Optional Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `PORT` | Server port | `3000` | `3000` |
| `DB_SSL` | Enable SSL for database | `false` | `true` |
| `DB_SSL_REJECT_UNAUTHORIZED` | Reject unauthorized SSL | `true` | `false` |
| `JWT_EXPIRES_IN` | JWT token expiration | `24h` | `7d`, `1h` |
| `ADMIN_EMAIL` | First admin user email | `admin@example.com` | `admin@company.com` |
| `ADMIN_PASSWORD` | First admin user password | `admin123` | `SecurePassword123!` |

## Security Best Practices

1. **Never commit `.env` files to version control**
   - All `.env*` files are in `.gitignore`
   - Use `.env.example` files as templates

2. **Use strong secrets in production**
   - Generate JWT_SECRET: `openssl rand -base64 32`
   - Use complex passwords for admin accounts
   - Rotate secrets regularly

3. **Use different databases for each environment**
   - Development: `attendance_system_dev`
   - Production: `attendance_system_prod`
   - Test: `attendance_system_test`

4. **Enable SSL for production databases**
   - Set `DB_SSL=true` in production
   - Verify SSL certificates are valid

5. **Use environment-specific admin credentials**
   - Different admin emails/passwords per environment
   - Never use production credentials in development

## Troubleshooting

### Environment file not loading

1. Check `NODE_ENV` is set correctly
2. Verify the `.env.${NODE_ENV}` file exists
3. Check file permissions
4. Ensure no syntax errors in the file

### Database connection issues

1. Verify database credentials match your PostgreSQL setup
2. Check database exists: `CREATE DATABASE attendance_system_dev;`
3. For remote databases, ensure `DB_SSL=true` if required
4. Check firewall rules allow connections

### JWT authentication fails

1. Ensure `JWT_SECRET` is set and consistent across restarts
2. Verify `JWT_SECRET` is at least 32 characters
3. Check `JWT_EXPIRES_IN` format is correct (e.g., `24h`, `7d`)

## Quick Start

1. Copy the appropriate example file:
   ```bash
   # For development
   cp .env.development.example .env.development
   
   # For production
   cp .env.production.example .env.production
   ```

2. Edit the file with your actual values

3. Run the application:
   ```bash
   npm run start:dev  # Uses .env.development
   ```

