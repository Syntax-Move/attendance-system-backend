import { Sequelize, QueryTypes } from 'sequelize';
import { Sequelize as SequelizeTypes } from 'sequelize-typescript';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs';

async function runMigrations() {
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
    console.log('✓ Database connection established successfully.');

    // Create migrations table if it doesn't exist
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "SequelizeMeta" (
        name VARCHAR(255) NOT NULL PRIMARY KEY
      );
    `);

    const migrationsPath = path.join(__dirname, '.');
    const migrationFiles = fs
      .readdirSync(migrationsPath)
      .filter((file) => file.endsWith('.js') && file !== 'run-migrations.js')
      .sort();

    console.log(`\nFound ${migrationFiles.length} migration files.\n`);

    // Get already run migrations
    const executedMigrations = await sequelize.query(
      'SELECT name FROM "SequelizeMeta"',
      { type: QueryTypes.SELECT }
    ) as any[];
    const executedNames = (executedMigrations || []).map((m: any) => m.name);

    for (const file of migrationFiles) {
      if (executedNames.includes(file)) {
        console.log(`⏭  Migration ${file} already executed. Skipping...`);
        continue;
      }

      console.log(`▶  Running migration: ${file}`);
      const migration = require(path.join(migrationsPath, file));
      
      if (typeof migration.up === 'function') {
        await sequelize.transaction(async (transaction) => {
          await migration.up(sequelize.getQueryInterface(), Sequelize);
          await sequelize.query(
            `INSERT INTO "SequelizeMeta" (name) VALUES ('${file}')`,
            { transaction }
          );
        });
        console.log(`✓ Migration ${file} completed successfully.\n`);
      } else {
        console.warn(`⚠ Migration ${file} does not have an up function.\n`);
      }
    }

    console.log('✓ All migrations completed successfully!');
  } catch (error) {
    console.error('✗ Migration failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
    await app.close();
  }
}

runMigrations();
