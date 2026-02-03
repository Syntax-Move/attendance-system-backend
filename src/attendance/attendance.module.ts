import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { MissingAttendanceProcessorService } from './missing-attendance-processor.service';
import { AttendanceCronService } from './attendance-cron.service';
import { DatabaseModule } from '../database/database.module';
import { EmployeesModule } from '../employees/employees.module';
import { SalaryCalculator } from '../common/utils/salary-calculator.util';
import { LeaveBalanceUtil } from '../common/utils/leave-balance.util';
import { AttendanceRulesUtil } from '../common/utils/attendance-rules.util';
import { Attendance } from '../database/models/attendance.model';
import { Employee } from '../database/models/employee.model';
import { PublicHoliday } from '../database/models/public-holiday.model';
import { MonthlyAttendanceSummary } from '../database/models/monthly-attendance-summary.model';

@Module({
  imports: [
    DatabaseModule,
    EmployeesModule,
    SequelizeModule.forFeature([
      Attendance,
      Employee,
      PublicHoliday,
      MonthlyAttendanceSummary,
    ]),
  ],
  controllers: [AttendanceController],
  providers: [
    AttendanceService,
    MissingAttendanceProcessorService,
    AttendanceCronService,
    AttendanceRulesUtil,
    SalaryCalculator,
    LeaveBalanceUtil,
  ],
  exports: [AttendanceService, MissingAttendanceProcessorService],
})
export class AttendanceModule {}

