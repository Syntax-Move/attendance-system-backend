import { Module } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { EmployeesController } from './employees.controller';
import { DatabaseModule } from '../database/database.module';
import { UsersModule } from '../users/users.module';
import { LeaveBalanceUtil } from '../common/utils/leave-balance.util';

@Module({
  imports: [DatabaseModule, UsersModule],
  controllers: [EmployeesController],
  providers: [EmployeesService, LeaveBalanceUtil],
  exports: [EmployeesService],
})
export class EmployeesModule {}

