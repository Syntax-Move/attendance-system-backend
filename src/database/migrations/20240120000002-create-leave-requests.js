'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('leave_requests', {
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
      date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        comment: 'Date for which leave is requested',
      },
      hours: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Number of hours for leave (1-9)',
      },
      status: {
        type: Sequelize.ENUM('pending', 'approved', 'rejected'),
        allowNull: false,
        defaultValue: 'pending',
      },
      reason: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Optional reason for leave',
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

    // Create unique index on employeeId and date
    await queryInterface.addIndex('leave_requests', ['employeeId', 'date'], {
      unique: true,
      name: 'leave_requests_employeeId_date_unique',
    });

    // Create index on status for faster queries
    await queryInterface.addIndex('leave_requests', ['status'], {
      name: 'leave_requests_status_idx',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('leave_requests');
    // Note: ENUM type removal might need manual SQL in PostgreSQL
    // await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_leave_requests_status";');
  },
};



