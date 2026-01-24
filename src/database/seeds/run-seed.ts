import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { CreateAdminUserSeed } from './create-admin-user.seed';
import { CreateEmployeesSeed } from './create-employees.seed';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const seedType = process.argv[2] || 'admin'; // Default to admin seed
  
  try {
    if (seedType === 'employees' || seedType === 'all') {
      const employeesSeed = app.get(CreateEmployeesSeed);
      await employeesSeed.createEmployees();
    }
    
    if (seedType === 'admin' || seedType === 'all') {
      const adminSeed = app.get(CreateAdminUserSeed);
      await adminSeed.createAdminUser();
    }
    
    console.log('Seed completed successfully!');
    await app.close();
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    await app.close();
    process.exit(1);
  }
}

bootstrap();

