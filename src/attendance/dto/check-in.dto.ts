import { IsString, IsDateString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CheckInDto {
  @ApiProperty({
    example: '2024-01-15T12:00:00.000Z',
    description: 'Check-in datetime',
  })
  @IsDateString()
  checkInDateTime: string;

  @ApiProperty({
    example: '2024-01-15T12:00:00.000Zsyntax_move',
    description: 'QR code result (datetime + syntax_move)',
  })
  @IsString()
  @Matches(/.*syntax_move$/, {
    message: 'QR code must end with "syntax_move"',
  })
  qrCode: string;
}

