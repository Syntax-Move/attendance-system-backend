import {
  IsString,
  IsEmail,
  MinLength,
  IsNumber,
  IsDateString,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../common/enums/user-role.enum';

export class CreateEmployeeDto {
  @ApiProperty({ example: 'employee@example.com', description: 'Employee email address' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123', description: 'Password', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ enum: UserRole, example: UserRole.EMPLOYEE, description: 'User role' })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiProperty({ example: 'John Doe', description: 'Full name of the employee' })
  @IsString()
  fullName: string;

  @ApiProperty({ example: '+1234567890', description: 'Phone number' })
  @IsString()
  phone: string;

  @ApiProperty({ example: 'Software Developer', description: 'Job designation' })
  @IsString()
  designation: string;

  @ApiProperty({ example: 1000, description: 'Daily salary amount' })
  @IsNumber()
  dailySalary: number;

  @ApiProperty({ example: '2024-01-01', description: 'Joining date (YYYY-MM-DD)' })
  @IsDateString()
  joiningDate: string;
}

