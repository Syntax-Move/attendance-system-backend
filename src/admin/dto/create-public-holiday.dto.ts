import { IsString, IsDateString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePublicHolidayDto {
  @ApiProperty({ example: '2024-01-26', description: 'Date of the public holiday (YYYY-MM-DD)' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: 'Republic Day', description: 'Name/description of the holiday' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'National holiday', description: 'Optional description or notes' })
  @IsOptional()
  @IsString()
  description?: string;
}

