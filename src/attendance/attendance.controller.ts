import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  UseGuards,
  Param,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { MissingAttendanceProcessorService } from './missing-attendance-processor.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { EmployeeGuard } from '../common/guards/employee.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { AttendanceHistoryQueryDto } from './dto/attendance-history-query.dto';
import { EmployeesService } from '../employees/employees.service';
import { CheckInResponseDto } from './dto/check-in-response.dto';
import { CheckOutResponseDto } from './dto/check-out-response.dto';
import { TodayAttendanceResponseDto } from './dto/today-attendance-response.dto';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';

@ApiTags('attendance')
@ApiBearerAuth('JWT-auth')
@Controller('attendance')
@UseGuards(JwtAuthGuard)
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly employeesService: EmployeesService,
    private readonly missingAttendanceProcessor: MissingAttendanceProcessorService,
  ) {}

  @Get('today')
  @UseGuards(EmployeeGuard)
  @ApiOperation({
    summary: 'Get today\'s attendance status (Employee only)',
    description: 'Returns today\'s attendance record and indicates what action is available (check-in, check-out, or none). Used by mobile app to determine which button to show.',
  })
  @ApiResponse({
    status: 200,
    description: 'Today\'s attendance status retrieved successfully',
    type: TodayAttendanceResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Employee access required' })
  async getTodayAttendance(@CurrentUser() user: CurrentUserPayload) {
    const employee = await this.employeesService.findByUserId(user.userId);
    return this.attendanceService.getTodayAttendance(employee.id);
  }

  @Post('check-in')
  @UseGuards(EmployeeGuard)
  @ApiOperation({
    summary: 'Check in for the day (Employee only)',
    description: 'Records the employee check-in time for today. Requires a valid QR code and datetime. Can only be called once per day.',
  })
  @ApiResponse({
    status: 201,
    description: 'Check-in successful',
    type: CheckInResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Already checked in today or invalid QR code' })
  @ApiResponse({ status: 403, description: 'Employee access required or account is inactive' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  async checkIn(
    @CurrentUser() user: CurrentUserPayload,
    @Body() checkInDto: CheckInDto,
  ) {
    const employee = await this.employeesService.findByUserId(user.userId);
    return this.attendanceService.checkIn(employee.id, checkInDto);
  }

  @Post('check-out')
  @UseGuards(EmployeeGuard)
  @ApiOperation({
    summary: 'Check out and calculate salary (Employee only)',
    description: 'Records the employee check-out time for today and automatically calculates worked hours, short minutes, and salary earned. Requires a valid check-in for today and a valid QR code.',
  })
  @ApiResponse({
    status: 201,
    description: 'Check-out successful with calculated salary',
    type: CheckOutResponseDto,
  })
  @ApiResponse({ status: 400, description: 'No check-in found, already checked out, invalid QR code, or check-out time must be after check-in time' })
  @ApiResponse({ status: 403, description: 'Employee access required or account is inactive' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  async checkOut(
    @CurrentUser() user: CurrentUserPayload,
    @Body() checkOutDto: CheckOutDto,
  ) {
    const employee = await this.employeesService.findByUserId(user.userId);
    return this.attendanceService.checkOut(employee.id, checkOutDto);
  }

  @Get('my-history')
  @UseGuards(EmployeeGuard)
  @ApiOperation({
    summary: 'Get personal attendance history (Employee only)',
    description: 'Retrieves the authenticated employee\'s attendance history. Can be filtered by date range or by month/year. Returns attendance records with employee information.',
  })
  @ApiResponse({
    status: 200,
    description: 'Attendance history retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
          employeeId: { type: 'string' },
          date: { type: 'string', example: '2024-01-15' },
          checkInTime: { type: 'string', format: 'date-time', nullable: true },
          checkOutTime: { type: 'string', format: 'date-time', nullable: true },
          totalWorkedMinutes: { type: 'number', nullable: true },
          shortMinutes: { type: 'number', nullable: true },
          salaryEarned: { type: 'number', nullable: true },
          employee: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              fullName: { type: 'string' },
              designation: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Employee access required' })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Start date in YYYY-MM-DD format. Must be used with endDate.',
    example: '2024-01-01',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'End date in YYYY-MM-DD format. Must be used with startDate.',
    example: '2024-01-31',
  })
  @ApiQuery({
    name: 'month',
    required: false,
    type: Number,
    description: 'Month number (1-12). Must be used with year.',
    example: 1,
  })
  @ApiQuery({
    name: 'year',
    required: false,
    type: Number,
    description: 'Year (e.g., 2024). Must be used with month.',
    example: 2024,
  })
  async getMyHistory(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: AttendanceHistoryQueryDto,
  ) {
    const employee = await this.employeesService.findByUserId(user.userId);
    return this.attendanceService.getMyHistory(employee.id, query);
  }

  @Get()
  @UseGuards(AdminGuard)
  @ApiOperation({
    summary: 'Get all attendance records (Admin only)',
    description: 'Retrieves all attendance records in the system. Can be filtered by employee ID and/or date range. Returns attendance records with employee and user information.',
  })
  @ApiResponse({
    status: 200,
    description: 'Attendance records retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
          employeeId: { type: 'string' },
          date: { type: 'string', example: '2024-01-15' },
          checkInTime: { type: 'string', format: 'date-time', nullable: true },
          checkOutTime: { type: 'string', format: 'date-time', nullable: true },
          totalWorkedMinutes: { type: 'number', nullable: true },
          shortMinutes: { type: 'number', nullable: true },
          salaryEarned: { type: 'number', nullable: true },
          employee: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              fullName: { type: 'string' },
              designation: { type: 'string' },
              phone: { type: 'string' },
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  @ApiQuery({
    name: 'employeeId',
    required: false,
    type: String,
    description: 'Filter attendance records by specific employee ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Start date in YYYY-MM-DD format. Must be used with endDate.',
    example: '2024-01-01',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'End date in YYYY-MM-DD format. Must be used with startDate.',
    example: '2024-01-31',
  })
  async getAllAttendance(
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

  @Delete(':id')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete attendance record by ID (Admin only)',
    description: 'Deletes a specific attendance record by ID. Automatically deletes related salary deduction ledger entries and recalculates monthly attendance summary if the attendance had a check-out time.',
  })
  @ApiParam({
    name: 'id',
    description: 'Attendance UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Attendance record deleted successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Attendance record deleted successfully. Related records updated.',
        },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  @ApiResponse({ status: 404, description: 'Attendance record not found' })
  async deleteAttendanceById(@Param('id') id: string) {
    return this.attendanceService.deleteAttendanceById(id);
  }

  @Delete()
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete all attendance records (Admin only)',
    description: 'Deletes all attendance records in the system. Automatically deletes all related salary deduction ledger entries and recalculates all affected monthly attendance summaries. Use with caution!',
  })
  @ApiResponse({
    status: 200,
    description: 'All attendance records deleted successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'All attendance records deleted successfully. Related records updated.',
        },
        deletedCount: {
          type: 'number',
          example: 150,
          description: 'Number of attendance records deleted',
        },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  async deleteAllAttendances() {
    return this.attendanceService.deleteAllAttendances();
  }

  @Post('process-missing')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Process missing attendance for current month (Admin only)',
    description: 'Processes missing attendance days for all employees or a specific employee. For each missing working day, it first deducts from leave balance, then counts as short minutes if leave is exhausted.',
  })
  @ApiQuery({
    name: 'employeeId',
    required: false,
    type: String,
    description: 'Optional employee ID. If not provided, processes for all employees.',
  })
  @ApiResponse({
    status: 200,
    description: 'Missing attendance processed successfully',
    schema: {
      type: 'object',
      properties: {
        processedDays: { type: 'number' },
        leaveDeducted: { type: 'number', description: 'Total minutes deducted from leave' },
        shortMinutesAdded: { type: 'number', description: 'Total short minutes added' },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  async processMissingAttendance(@Query('employeeId') employeeId?: string) {
    if (employeeId) {
      return this.missingAttendanceProcessor.processCurrentMonthMissingAttendance(employeeId);
    } else {
      return this.missingAttendanceProcessor.processCurrentMonthMissingAttendance();
    }
  }

  @Get('dashboard')
  @UseGuards(EmployeeGuard)
  @ApiOperation({
    summary: 'Get user dashboard/info (Employee only)',
    description: 'Returns comprehensive user information including current month stats, missing minutes, working days (excluding public holidays), salary info, and leave requests.',
  })
  @ApiResponse({
    status: 200,
    description: 'User dashboard retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        employee: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            fullName: { type: 'string' },
            designation: { type: 'string' },
            dailySalary: { type: 'number' },
          },
        },
        currentMonth: {
          type: 'object',
          properties: {
            month: { type: 'number' },
            year: { type: 'number' },
            totalWorkedMinutes: { type: 'number' },
            totalShortMinutes: { type: 'number' },
            missingMinutes: { type: 'number' },
            allowedShortMinutes: { type: 'number' },
            totalSalaryEarned: { type: 'number' },
            totalDeductions: { type: 'number' },
            netSalary: { type: 'number' },
            workingDays: { type: 'number' },
            daysWorked: { type: 'number' },
            leaveRequests: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  date: { type: 'string' },
                  hours: { type: 'number' },
                  status: { type: 'string' },
                  reason: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
        totalSalary: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Employee access required' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  async getUserDashboard(@CurrentUser() user: CurrentUserPayload) {
    const employee = await this.employeesService.findByUserId(user.userId);
    return this.attendanceService.getUserDashboard(employee.id);
  }

  @Post('leave-request')
  @UseGuards(EmployeeGuard)
  @ApiOperation({
    summary: 'Request leave for a specific day (Employee only)',
    description: 'Submit a leave request for today or a future date. Can be full day (9 hours) or partial (1-9 hours).',
  })
  @ApiResponse({
    status: 201,
    description: 'Leave request submitted successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        employeeId: { type: 'string' },
        date: { type: 'string', format: 'date' },
        hours: { type: 'number' },
        status: { type: 'string', enum: ['pending', 'approved', 'rejected'] },
        reason: { type: 'string', nullable: true },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid hours, date in past, or leave/attendance already exists for this date' })
  @ApiResponse({ status: 403, description: 'Employee access required' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  async requestLeave(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { date: string; days?: number; hours?: number; reason?: string },
  ) {
    const employee = await this.employeesService.findByUserId(user.userId);
    const useDays = body.days != null;
    const value = useDays ? body.days! : (body.hours ?? 0);
    if (value <= 0) {
      throw new BadRequestException('Provide either days (e.g. 0.5, 1, 1.5) or hours');
    }
    return this.attendanceService.requestLeave(
      employee.id,
      new Date(body.date),
      value,
      body.reason,
      useDays,
    );
  }

  @Get('leave-requests')
  @UseGuards(EmployeeGuard)
  @ApiOperation({
    summary: 'Get user leave requests (Employee only)',
    description: 'Retrieves the authenticated employee\'s leave requests. Can be filtered by month and year.',
  })
  @ApiResponse({
    status: 200,
    description: 'Leave requests retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          date: { type: 'string', format: 'date' },
          hours: { type: 'number' },
          status: { type: 'string', enum: ['pending', 'approved', 'rejected'] },
          reason: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Employee access required' })
  @ApiQuery({
    name: 'month',
    required: false,
    type: Number,
    description: 'Month number (1-12). Must be used with year.',
    example: 1,
  })
  @ApiQuery({
    name: 'year',
    required: false,
    type: Number,
    description: 'Year (e.g., 2024). Must be used with month.',
    example: 2024,
  })
  async getMyLeaveRequests(
    @CurrentUser() user: CurrentUserPayload,
    @Query('month') month?: number,
    @Query('year') year?: number,
  ) {
    const employee = await this.employeesService.findByUserId(user.userId);
    return this.attendanceService.getMyLeaveRequests(employee.id, month, year);
  }
}

