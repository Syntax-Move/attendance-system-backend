/**
 * One-off: run only migration 20240120000010 (add isLate, isHalfDay, days, unpaidDays).
 * Use when SequelizeMeta is empty but DB already has older schema.
 */
import { Sequelize } from 'sequelize';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const configService = app.get(ConfigService);
  const dbConfig = configService.get('database');

  const sequelize = new Sequelize({
    dialect: 'postgres',
    host: dbConfig.host,
    port: dbConfig.port,
    username: dbConfig.username,
    password: dbConfig.password,
    database: dbConfig.database,
    logging: console.log,
    dialectOptions: dbConfig.dialectOptions || {},
  });

  try {
    await sequelize.authenticate();
    console.log('✓ Database connected.');

    const migration = require(path.join(__dirname, '20240120000010-add-attendance-rules-and-leave-days.js'));
    const queryInterface = sequelize.getQueryInterface();
    const SequelizeModule = require('sequelize').Sequelize;

    await sequelize.transaction(async (transaction) => {
      await migration.up(queryInterface, SequelizeModule);
      await sequelize.query(
        `INSERT INTO "SequelizeMeta" (name) VALUES ('20240120000010-add-attendance-rules-and-leave-days.js') ON CONFLICT (name) DO NOTHING`,
        { transaction }
      );
    });

    console.log('✓ Migration 20240120000010 completed.');
  } catch (err) {
    console.error('✗ Migration failed:', err);
    process.exit(1);
  } finally {
    await sequelize.close();
    await app.close();
  }
}

run();
