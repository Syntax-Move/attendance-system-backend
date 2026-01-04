import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { DatabaseModule } from '../database/database.module';
import { EmployeesModule } from '../employees/employees.module';

@Module({
  imports: [DatabaseModule, EmployeesModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}

