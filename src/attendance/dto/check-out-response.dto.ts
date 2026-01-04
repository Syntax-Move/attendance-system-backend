import { ApiProperty } from '@nestjs/swagger';

export class CheckOutResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  employeeId: string;

  @ApiProperty({ example: '2024-01-15' })
  date: string;

  @ApiProperty({ example: '2024-01-15T12:00:00.000Z' })
  checkInTime: Date;

  @ApiProperty({ example: '2024-01-15T21:00:00.000Z' })
  checkOutTime: Date;

  @ApiProperty({ example: 540, description: 'Total worked minutes' })
  totalWorkedMinutes: number;

  @ApiProperty({ example: 0, description: 'Short minutes (if worked < 9 hours)' })
  shortMinutes: number;

  @ApiProperty({ example: 1000.0, description: 'Salary earned for this day' })
  salaryEarned: number;

  @ApiProperty({ example: 'Check-out successful' })
  message: string;
}

