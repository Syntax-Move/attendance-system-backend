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
  @ApiOperation({ summary: 'Create new user (admin or employee)' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - validation error or email already exists' })
  createUser(@Body() createUserDto: CreateUserDto) {
    return this.adminService.createUser(createUserDto);
  }

  @Get('salary/monthly')
  @ApiOperation({ summary: 'Get monthly salary report for all employees' })
  @ApiQuery({ name: 'month', type: Number, description: 'Month (1-12)', required: true })
  @ApiQuery({ name: 'year', type: Number, description: 'Year', required: true })
  @ApiResponse({ status: 200, description: 'Monthly salary report retrieved successfully' })
  getMonthlySalaryReport(
    @Query('month', ParseIntPipe) month: number,
    @Query('year', ParseIntPipe) year: number,
  ) {
    return this.adminService.getMonthlySalaryReport(month, year);
  }

  @Get('salary/employee/:id')
  @ApiOperation({ summary: 'Get employee salary report' })
  @ApiParam({ name: 'id', description: 'Employee ID' })
  @ApiQuery({ name: 'month', type: Number, description: 'Month (1-12)', required: false })
  @ApiQuery({ name: 'year', type: Number, description: 'Year', required: false })
  @ApiResponse({ status: 200, description: 'Employee salary report retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Employee not found' })
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

