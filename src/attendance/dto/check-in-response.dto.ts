import { ApiProperty } from '@nestjs/swagger';

export class CheckInResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  employeeId: string;

  @ApiProperty({ example: '2024-01-15' })
  date: string;

  @ApiProperty({ example: '2024-01-15T12:00:00.000Z' })
  checkInTime: Date | null;

  @ApiProperty({ example: 'Check-in successful' })
  message: string;
}

