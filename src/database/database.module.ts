import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import {
  User,
  Employee,
  Attendance,
  MonthlyAttendanceSummary,
  SalaryDeductionLedger,
} from './models';

@Module({
  imports: [
    SequelizeModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const dbConfig = configService.get('database');
        return {
          ...dbConfig,
          models: [
            User,
            Employee,
            Attendance,
            MonthlyAttendanceSummary,
            SalaryDeductionLedger,
          ],
          // Global default: return model instances (not raw objects)
          // To get raw objects, explicitly pass { raw: true } in queries
          // Sequelize defaults to raw: false, so model instances are returned by default
        };
      },
      inject: [ConfigService],
    }),
    SequelizeModule.forFeature([
      User,
      Employee,
      Attendance,
      MonthlyAttendanceSummary,
      SalaryDeductionLedger,
    ]),
  ],
  exports: [SequelizeModule],
})
export class DatabaseModule {}

