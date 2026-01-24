import {
  IsString,
  IsNumber,
  IsDateString,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateEmployeeDto {
  @ApiPropertyOptional({ example: 'John Doe', description: 'Full name of the employee' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ example: '+1234567890', description: 'Phone number' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'Software Developer', description: 'Job designation' })
  @IsOptional()
  @IsString()
  designation?: string;

  @ApiPropertyOptional({ example: 1000, description: 'Daily salary amount' })
  @IsOptional()
  @IsNumber()
  dailySalary?: number;

  @ApiPropertyOptional({ example: '2024-01-01', description: 'Joining date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  joiningDate?: string;

  @ApiPropertyOptional({ example: true, description: 'Employee active status' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ 
    example: 'full-time', 
    description: 'Employee status',
    enum: ['full-time', 'probation', 'notice-period']
  })
  @IsOptional()
  @IsString()
  status?: string;
}

