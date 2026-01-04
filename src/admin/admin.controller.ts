import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { CreateUserDto } from './dto/create-user.dto';

@ApiTags('admin')
@ApiBearerAuth('JWT-auth')
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

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
}

