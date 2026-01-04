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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
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
}

