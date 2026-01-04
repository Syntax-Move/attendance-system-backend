import {
  IsString,
  IsEmail,
  MinLength,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../common/enums/user-role.enum';

export class CreateUserDto {
  @ApiProperty({ example: 'user@example.com', description: 'User email address' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123', description: 'Password', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ enum: UserRole, example: UserRole.EMPLOYEE, description: 'User role' })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiPropertyOptional({ example: 'John Doe', description: 'Full name (required for employees)' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ example: '+1234567890', description: 'Phone number (required for employees)' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'Software Developer', description: 'Job designation (required for employees)' })
  @IsOptional()
  @IsString()
  designation?: string;

  @ApiPropertyOptional({ example: 1000, description: 'Daily salary (required for employees)' })
  @IsOptional()
  dailySalary?: number;

  @ApiPropertyOptional({ example: '2024-01-01', description: 'Joining date (required for employees, YYYY-MM-DD)' })
  @IsOptional()
  joiningDate?: string;
}

