import { IsString, IsDateString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CheckOutDto {
  @ApiProperty({
    example: '2024-01-15T21:00:00.000Z',
    description: 'Check-out datetime',
  })
  @IsDateString()
  checkOutDateTime: string;

  @ApiProperty({
    example: '2024-01-15T21:00:00.000Zsyntax_move',
    description: 'QR code result (datetime + syntax_move)',
  })
  @IsString()
  @Matches(/.*syntax_move$/, {
    message: 'QR code must end with "syntax_move"',
  })
  qrCode: string;
}

