import { Module } from '@nestjs/common';
import { CreateAdminUserSeed } from './create-admin-user.seed';
import { CreateEmployeesSeed } from './create-employees.seed';
import { DatabaseModule } from '../database.module';

@Module({
  imports: [DatabaseModule],
  providers: [CreateAdminUserSeed, CreateEmployeesSeed],
})
export class SeedsModule {}

