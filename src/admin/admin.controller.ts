import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Patch,
  Delete,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { CreatePublicHolidayDto } from './dto/create-public-holiday.dto';
import { UpdatePublicHolidayDto } from './dto/update-public-holiday.dto';
import { AttendanceService } from '../attendance/attendance.service';

@ApiTags('admin')
@ApiBearerAuth('JWT-auth')
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly attendanceService: AttendanceService,
  ) {}

  @Post('users')
  @ApiOperation({
    summary: 'Create new user (Admin only)',
    description: 'Creates a new user account (admin or employee). If role is "employee", an associated employee record must be created separately. The password will be hashed before storage.',
  })
  @ApiResponse({
    status: 201,
    description: 'User created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        email: { type: 'string' },
        role: { type: 'string', enum: ['admin', 'employee'] },
        isActive: { type: 'boolean', example: true },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation error or email already exists' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  createUser(@Body() createUserDto: CreateUserDto) {
    return this.adminService.createUser(createUserDto);
  }

  @Get('salary/monthly')
  @ApiOperation({
    summary: 'Get monthly salary report for all employees (Admin only)',
    description: 'Retrieves a comprehensive monthly salary report for all employees. Includes total worked minutes, short minutes, salary earned, and deductions for the specified month.',
  })
  @ApiQuery({
    name: 'month',
    type: Number,
    description: 'Month number (1-12)',
    required: true,
    example: 1,
  })
  @ApiQuery({
    name: 'year',
    type: Number,
    description: 'Year (e.g., 2024)',
    required: true,
    example: 2024,
  })
  @ApiResponse({
    status: 200,
    description: 'Monthly salary report retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          employeeId: { type: 'string' },
          employeeName: { type: 'string' },
          totalWorkedMinutes: { type: 'number' },
          totalShortMinutes: { type: 'number' },
          totalSalaryEarned: { type: 'number' },
          totalDeductions: { type: 'number' },
          netSalary: { type: 'number' },
        },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  getMonthlySalaryReport(
    @Query('month', ParseIntPipe) month: number,
    @Query('year', ParseIntPipe) year: number,
  ) {
    return this.adminService.getMonthlySalaryReport(month, year);
  }

  @Get('salary/employee/:id')
  @ApiOperation({
    summary: 'Get employee salary report (Admin only)',
    description: 'Retrieves a detailed salary report for a specific employee. If month and year are provided, returns data for that specific month. Otherwise, returns all-time data including all attendance records and deductions.',
  })
  @ApiParam({
    name: 'id',
    description: 'Employee UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiQuery({
    name: 'month',
    type: Number,
    description: 'Month number (1-12). Optional - if not provided, returns all-time data.',
    required: false,
    example: 1,
  })
  @ApiQuery({
    name: 'year',
    type: Number,
    description: 'Year (e.g., 2024). Optional - if not provided, returns all-time data.',
    required: false,
    example: 2024,
  })
  @ApiResponse({
    status: 200,
    description: 'Employee salary report retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        employee: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            fullName: { type: 'string' },
            email: { type: 'string' },
          },
        },
        totalSalary: { type: 'number', description: 'Total salary earned' },
        totalDeductions: { type: 'number', description: 'Total deductions' },
        netSalary: { type: 'number', description: 'Net salary (totalSalary - totalDeductions)' },
        attendances: {
          type: 'array',
          description: 'List of attendance records',
        },
        deductions: {
          type: 'array',
          description: 'List of salary deduction records',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Employee not found' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  getEmployeeSalaryReport(
    @Param('id') employeeId: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.adminService.getEmployeeSalaryReport(
      employeeId,
      month ? parseInt(month, 10) : undefined,
      year ? parseInt(year, 10) : undefined,
    );
  }

  @Get('attendance')
  @ApiOperation({
    summary: 'Get all attendance records with filters (Admin only)',
    description: 'Retrieves all attendance records with optional filters for employee, date range, etc.',
  })
  @ApiQuery({
    name: 'employeeId',
    required: false,
    type: String,
    description: 'Filter by employee UUID',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Start date in YYYY-MM-DD format',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'End date in YYYY-MM-DD format',
  })
  @ApiResponse({
    status: 200,
    description: 'Attendance records retrieved successfully',
  })
  getAllAttendance(
    @Query('employeeId') employeeId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.attendanceService.getAllAttendance({
      employeeId,
      startDate,
      endDate,
    });
  }

  @Get('leave-requests')
  @ApiOperation({
    summary: 'Get all leave requests (Admin only)',
    description: 'Retrieves all leave requests with optional filters',
  })
  @ApiQuery({
    name: 'employeeId',
    required: false,
    type: String,
    description: 'Filter by employee UUID',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    description: 'Filter by status',
  })
  @ApiResponse({
    status: 200,
    description: 'Leave requests retrieved successfully',
  })
  getAllLeaveRequests(
    @Query('employeeId') employeeId?: string,
    @Query('status') status?: string,
  ) {
    return this.adminService.getAllLeaveRequests(employeeId, status);
  }

  @Patch('leave-requests/:id/approve')
  @ApiOperation({
    summary: 'Approve leave request (Admin only)',
    description: 'Approves a leave request. If leave balance is sufficient, deducts from balance. If insufficient, deducts available balance and marks remaining hours as unpaid leave. Creates attendance record for unpaid leave.',
  })
  @ApiParam({
    name: 'id',
    description: 'Leave request UUID',
  })
  @ApiResponse({
    status: 200,
    description: 'Leave request approved successfully',
  })
  @ApiResponse({ status: 400, description: 'Leave request already processed' })
  @ApiResponse({ status: 404, description: 'Leave request not found' })
  approveLeaveRequest(@Param('id') id: string) {
    return this.adminService.approveLeaveRequest(id);
  }

  @Patch('leave-requests/:id/reject')
  @ApiOperation({
    summary: 'Reject leave request (Admin only)',
    description: 'Rejects a leave request',
  })
  @ApiParam({
    name: 'id',
    description: 'Leave request UUID',
  })
  @ApiResponse({
    status: 200,
    description: 'Leave request rejected successfully',
  })
  @ApiResponse({ status: 400, description: 'Leave request already processed' })
  @ApiResponse({ status: 404, description: 'Leave request not found' })
  rejectLeaveRequest(@Param('id') id: string) {
    return this.adminService.rejectLeaveRequest(id);
  }

  @Get('employees/:id/leave-balance')
  @ApiOperation({
    summary: 'Get employee leave balance (Admin only)',
    description: 'Gets the leave balance for a specific employee for a given month and year',
  })
  @ApiParam({
    name: 'id',
    description: 'Employee UUID',
  })
  @ApiQuery({
    name: 'month',
    required: false,
    type: Number,
    description: 'Month number (1-12). Defaults to current month.',
  })
  @ApiQuery({
    name: 'year',
    required: false,
    type: Number,
    description: 'Year. Defaults to current year.',
  })
  @ApiResponse({
    status: 200,
    description: 'Leave balance retrieved successfully',
  })
  getEmployeeLeaveBalance(
    @Param('id') employeeId: string,
    @Query('month') month?: number,
    @Query('year') year?: number,
  ) {
    return this.adminService.getEmployeeLeaveBalance(employeeId, month, year);
  }

  @Post('public-holidays')
  @ApiOperation({
    summary: 'Create public holiday (Admin only)',
    description: 'Creates a new public holiday and automatically creates attendance records for all employees for that date with isPublicHoliday=true',
  })
  @ApiResponse({
    status: 201,
    description: 'Public holiday created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        date: { type: 'string', format: 'date' },
        name: { type: 'string' },
        description: { type: 'string', nullable: true },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Public holiday already exists for this date' })
  createPublicHoliday(@Body() createPublicHolidayDto: CreatePublicHolidayDto) {
    return this.adminService.createPublicHoliday(createPublicHolidayDto);
  }

  @Get('public-holidays')
  @ApiOperation({
    summary: 'Get all public holidays (Admin only)',
    description: 'Retrieves all public holidays ordered by date (ascending)',
  })
  @ApiResponse({
    status: 200,
    description: 'Public holidays retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          date: { type: 'string', format: 'date' },
          name: { type: 'string' },
          description: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  getAllPublicHolidays() {
    return this.adminService.getAllPublicHolidays();
  }

  @Get('public-holidays/:id')
  @ApiOperation({
    summary: 'Get public holiday by ID (Admin only)',
    description: 'Retrieves a specific public holiday by its ID',
  })
  @ApiParam({
    name: 'id',
    description: 'Public holiday UUID',
  })
  @ApiResponse({
    status: 200,
    description: 'Public holiday retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Public holiday not found' })
  getPublicHolidayById(@Param('id') id: string) {
    return this.adminService.getPublicHolidayById(id);
  }

  @Patch('public-holidays/:id')
  @ApiOperation({
    summary: 'Update public holiday (Admin only)',
    description: 'Updates a public holiday (name and/or description). Date cannot be changed.',
  })
  @ApiParam({
    name: 'id',
    description: 'Public holiday UUID',
  })
  @ApiResponse({
    status: 200,
    description: 'Public holiday updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Public holiday not found' })
  updatePublicHoliday(
    @Param('id') id: string,
    @Body() updatePublicHolidayDto: UpdatePublicHolidayDto,
  ) {
    return this.adminService.updatePublicHoliday(id, updatePublicHolidayDto);
  }

  @Delete('public-holidays/:id')
  @ApiOperation({
    summary: 'Delete public holiday (Admin only)',
    description: 'Deletes a public holiday and updates attendance records to remove the public holiday mark',
  })
  @ApiParam({
    name: 'id',
    description: 'Public holiday UUID',
  })
  @ApiResponse({
    status: 200,
    description: 'Public holiday deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Public holiday not found' })
  deletePublicHoliday(@Param('id') id: string) {
    return this.adminService.deletePublicHoliday(id);
  }
}

