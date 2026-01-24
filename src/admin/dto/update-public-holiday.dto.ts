import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePublicHolidayDto {
  @ApiPropertyOptional({ example: 'Republic Day', description: 'Name/description of the holiday' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'National holiday', description: 'Optional description or notes' })
  @IsOptional()
  @IsString()
  description?: string;
}

