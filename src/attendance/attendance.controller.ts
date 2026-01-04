import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
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

  @Post('check-in')
  @UseGuards(EmployeeGuard)
  @ApiOperation({ summary: 'Check in for the day (Employee only)' })
  @ApiResponse({ status: 201, description: 'Check-in successful', type: CheckInResponseDto })
  @ApiResponse({ status: 400, description: 'Already checked in today or invalid QR code' })
  @ApiResponse({ status: 403, description: 'Employee access required' })
  async checkIn(
    @CurrentUser() user: CurrentUserPayload,
    @Body() checkInDto: CheckInDto,
  ) {
    const employee = await this.employeesService.findByUserId(user.userId);
    return this.attendanceService.checkIn(employee.id, checkInDto);
  }

  @Post('check-out')
  @UseGuards(EmployeeGuard)
  @ApiOperation({ summary: 'Check out and calculate salary (Employee only)' })
  @ApiResponse({ status: 201, description: 'Check-out successful', type: CheckOutResponseDto })
  @ApiResponse({ status: 400, description: 'No check-in found, already checked out, or invalid QR code' })
  @ApiResponse({ status: 403, description: 'Employee access required' })
  async checkOut(
    @CurrentUser() user: CurrentUserPayload,
    @Body() checkOutDto: CheckOutDto,
  ) {
    const employee = await this.employeesService.findByUserId(user.userId);
    return this.attendanceService.checkOut(employee.id, checkOutDto);
  }

  @Get('my-history')
  @UseGuards(EmployeeGuard)
  @ApiOperation({ summary: 'Get personal attendance history (Employee only)' })
  @ApiResponse({ status: 200, description: 'Attendance history retrieved successfully' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'End date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'month', required: false, type: Number, description: 'Month (1-12)' })
  @ApiQuery({ name: 'year', required: false, type: Number, description: 'Year' })
  async getMyHistory(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: AttendanceHistoryQueryDto,
  ) {
    const employee = await this.employeesService.findByUserId(user.userId);
    return this.attendanceService.getMyHistory(employee.id, query);
  }

  @Get()
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Get all attendance records (Admin only)' })
  @ApiResponse({ status: 200, description: 'Attendance records retrieved successfully' })
  @ApiQuery({ name: 'employeeId', required: false, type: String, description: 'Filter by employee ID' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'End date (YYYY-MM-DD)' })
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
}

