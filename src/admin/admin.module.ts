import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { DatabaseModule } from '../database/database.module';
import { EmployeesModule } from '../employees/employees.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { LeaveBalanceUtil } from '../common/utils/leave-balance.util';

@Module({
  imports: [DatabaseModule, EmployeesModule, AttendanceModule],
  controllers: [AdminController],
  providers: [AdminService, LeaveBalanceUtil],
})
export class AdminModule {}

