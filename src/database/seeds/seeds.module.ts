import { Module } from '@nestjs/common';
import { CreateAdminUserSeed } from './create-admin-user.seed';
import { DatabaseModule } from '../database.module';

@Module({
  imports: [DatabaseModule],
  providers: [CreateAdminUserSeed],
})
export class SeedsModule {}

