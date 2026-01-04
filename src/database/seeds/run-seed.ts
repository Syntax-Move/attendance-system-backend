import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { CreateAdminUserSeed } from './create-admin-user.seed';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const seedService = app.get(CreateAdminUserSeed);
  
  try {
    await seedService.createAdminUser();
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

