import { ApiProperty } from '@nestjs/swagger';

export class LoginResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', description: 'JWT access token' })
  accessToken: string;

  @ApiProperty({
    example: { id: '123e4567-e89b-12d3-a456-426614174000', email: 'employee@example.com', role: 'employee' },
    description: 'User information',
  })
  user: {
    id: string;
    email: string;
    role: string;
  };
}

