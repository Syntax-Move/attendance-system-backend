import { ApiProperty } from '@nestjs/swagger';

export class TodayAttendanceResponseDto {
  @ApiProperty({
    description: 'Attendance record for today. Null if no attendance record exists for today.',
    nullable: true,
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      employeeId: '123e4567-e89b-12d3-a456-426614174001',
      date: '2024-01-15',
      checkInTime: '2024-01-15T09:00:00.000Z',
      checkOutTime: null,
      totalWorkedMinutes: null,
      shortMinutes: null,
      salaryEarned: null,
    },
  })
  attendance: any | null;

  @ApiProperty({
    description: 'Action available to the user based on current attendance status. Use this to determine which button to show in the mobile app.',
    enum: ['check-in', 'check-out', 'none'],
    example: 'check-out',
    enumName: 'AttendanceAction',
  })
  action: 'check-in' | 'check-out' | 'none';

  @ApiProperty({
    description: 'Human-readable message about the current attendance status',
    examples: {
      noAttendance: {
        value: 'No attendance record for today. You can check in.',
        description: 'When no attendance exists',
      },
      checkedIn: {
        value: 'You have checked in. You can now check out.',
        description: 'When checked in but not checked out',
      },
      completed: {
        value: 'You have already completed check-in and check-out for today.',
        description: 'When both check-in and check-out are done',
      },
    },
  })
  message: string;
}

