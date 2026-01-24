'use strict';

/**
 * Quick script to add deletedAt column if it's missing
 * This can be run independently to fix the missing column issue
 */

const { Sequelize } = require('sequelize');
require('dotenv').config();

async function addDeletedAtIfMissing() {
  const sequelize = new Sequelize({
    dialect: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'attendance_system',
    logging: console.log,
    dialectOptions: process.env.DB_SSL === 'true' ? {
      ssl: {
        require: true,
        rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
      },
    } : {},
  });

  try {
    await sequelize.authenticate();
    console.log('✓ Database connection established successfully.');

    const queryInterface = sequelize.getQueryInterface();

    // Check and add deletedAt to users table
    try {
      const usersDesc = await queryInterface.describeTable('users');
      if (!usersDesc.deletedAt) {
        console.log('Adding deletedAt column to users table...');
        await queryInterface.addColumn('users', 'deletedAt', {
          type: Sequelize.DATE,
          allowNull: true,
        });
        console.log('✓ Added deletedAt to users table');
      } else {
        console.log('✓ deletedAt column already exists in users table');
      }
    } catch (error) {
      console.error('Error checking/adding deletedAt to users:', error.message);
    }

    // Check and add deletedAt to employees table
    try {
      const employeesDesc = await queryInterface.describeTable('employees');
      if (!employeesDesc.deletedAt) {
        console.log('Adding deletedAt column to employees table...');
        await queryInterface.addColumn('employees', 'deletedAt', {
          type: Sequelize.DATE,
          allowNull: true,
        });
        console.log('✓ Added deletedAt to employees table');
      } else {
        console.log('✓ deletedAt column already exists in employees table');
      }
    } catch (error) {
      console.error('Error checking/adding deletedAt to employees:', error.message);
    }

    // Check and add deletedAt to attendances table
    try {
      const attendancesDesc = await queryInterface.describeTable('attendances');
      if (!attendancesDesc.deletedAt) {
        console.log('Adding deletedAt column to attendances table...');
        await queryInterface.addColumn('attendances', 'deletedAt', {
          type: Sequelize.DATE,
          allowNull: true,
        });
        console.log('✓ Added deletedAt to attendances table');
      } else {
        console.log('✓ deletedAt column already exists in attendances table');
      }
    } catch (error) {
      console.error('Error checking/adding deletedAt to attendances:', error.message);
    }

    console.log('\n✓ All checks completed!');
  } catch (error) {
    console.error('✗ Error:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

addDeletedAtIfMissing();

