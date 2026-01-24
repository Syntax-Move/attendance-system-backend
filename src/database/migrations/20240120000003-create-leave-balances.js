'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('leave_balances', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },
      employeeId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'employees',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      month: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      year: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      balanceMinutes: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Leave balance in minutes (15 hours = 900 minutes per month)',
      },
      utilizedMinutes: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Leave utilized in minutes this month',
      },
      carryoverMinutes: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Carryover from previous month (max 9 hours = 540 minutes)',
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Create unique index on employeeId, month, and year
    await queryInterface.addIndex('leave_balances', ['employeeId', 'month', 'year'], {
      unique: true,
      name: 'leave_balances_employeeId_month_year_unique',
    });

    // Create index on employeeId for faster queries
    await queryInterface.addIndex('leave_balances', ['employeeId'], {
      name: 'leave_balances_employeeId_idx',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('leave_balances');
  },
};



