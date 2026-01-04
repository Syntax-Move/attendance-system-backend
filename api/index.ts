// Ensure pg is loaded before Sequelize
import 'pg';

import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import express from 'express';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

let cachedApp: express.Express;

async function createApp(): Promise<express.Express> {
  if (cachedApp) {
    return cachedApp;
  }

  // Suppress Express deprecation warnings for serverless environment
  const originalEmitWarning = process.emitWarning;
  process.emitWarning = function (warning: any, ...args: any[]) {
    if (warning && typeof warning === 'string' && warning.includes("'app.router' is deprecated")) {
      return; // Suppress this specific warning
    }
    return originalEmitWarning.apply(process, [warning, ...args]);
  };

  const expressApp = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp));

  // Enable CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle('Attendance System API')
    .setDescription('Company Attendance & Salary Management System API Documentation')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('auth', 'Authentication endpoints')
    .addTag('attendance', 'Attendance tracking endpoints')
    .addTag('employees', 'Employee management endpoints')
    .addTag('admin', 'Admin management endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.init();
  
  // Restore original emitWarning
  process.emitWarning = originalEmitWarning;
  
  cachedApp = expressApp;
  return expressApp;
}

export default async function handler(req: express.Request, res: express.Response): Promise<void> {
  const app = await createApp();
  app(req, res);
}

