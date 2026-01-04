import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';

@ApiTags('employees')
@ApiBearerAuth('JWT-auth')
@Controller('employees')
@UseGuards(JwtAuthGuard)
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  @UseGuards(AdminGuard)
  @ApiOperation({
    summary: 'Get all employees (Admin only)',
    description: 'Retrieves a list of all employees in the system with their associated user information (email, role, isActive). Results are ordered by creation date (newest first).',
  })
  @ApiResponse({
    status: 200,
    description: 'Employees retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
          userId: { type: 'string' },
          fullName: { type: 'string', example: 'John Doe' },
          phone: { type: 'string', example: '+1234567890' },
          designation: { type: 'string', example: 'Software Developer' },
          dailySalary: { type: 'number', example: 1000.0 },
          joiningDate: { type: 'string', example: '2024-01-01' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          user: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              email: { type: 'string' },
              role: { type: 'string', enum: ['admin', 'employee'] },
              isActive: { type: 'boolean' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  findAll() {
    return this.employeesService.findAll();
  }

  @Get(':id')
  @UseGuards(AdminGuard)
  @ApiOperation({
    summary: 'Get employee by ID (Admin only)',
    description: 'Retrieves detailed information about a specific employee by their ID, including associated user account details.',
  })
  @ApiParam({
    name: 'id',
    description: 'Employee UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Employee retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        userId: { type: 'string' },
        fullName: { type: 'string' },
        phone: { type: 'string' },
        designation: { type: 'string' },
        dailySalary: { type: 'number' },
        joiningDate: { type: 'string' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            role: { type: 'string', enum: ['admin', 'employee'] },
            isActive: { type: 'boolean' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  findOne(@Param('id') id: string) {
    return this.employeesService.findById(id);
  }

  @Post()
  @UseGuards(AdminGuard)
  @ApiOperation({
    summary: 'Create new employee (Admin only)',
    description: 'Creates a new employee account along with an associated user account. The user account will be created with the provided email and password. Both accounts are created in a transaction - if either fails, both are rolled back.',
  })
  @ApiResponse({
    status: 201,
    description: 'Employee and user account created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        userId: { type: 'string' },
        fullName: { type: 'string' },
        phone: { type: 'string' },
        designation: { type: 'string' },
        dailySalary: { type: 'number' },
        joiningDate: { type: 'string' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            role: { type: 'string' },
            isActive: { type: 'boolean' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation error or email already exists' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  create(@Body() createEmployeeDto: CreateEmployeeDto) {
    return this.employeesService.create(createEmployeeDto);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  @ApiOperation({
    summary: 'Update employee (Admin only)',
    description: 'Updates employee information. All fields are optional. If isActive is provided, it will update the associated user account\'s isActive status.',
  })
  @ApiParam({
    name: 'id',
    description: 'Employee UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Employee updated successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        fullName: { type: 'string' },
        phone: { type: 'string' },
        designation: { type: 'string' },
        dailySalary: { type: 'number' },
        joiningDate: { type: 'string' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            role: { type: 'string' },
            isActive: { type: 'boolean' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  update(@Param('id') id: string, @Body() updateEmployeeDto: UpdateEmployeeDto) {
    return this.employeesService.update(id, updateEmployeeDto);
  }

  @Patch(':id/deactivate')
  @UseGuards(AdminGuard)
  @ApiOperation({
    summary: 'Deactivate employee (Admin only)',
    description: 'Deactivates an employee by setting their associated user account\'s isActive status to false. This prevents the employee from logging in and using the system.',
  })
  @ApiParam({
    name: 'id',
    description: 'Employee UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Employee deactivated successfully. User account isActive set to false.',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            isActive: { type: 'boolean', example: false },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  deactivate(@Param('id') id: string) {
    return this.employeesService.deactivate(id);
  }
}

