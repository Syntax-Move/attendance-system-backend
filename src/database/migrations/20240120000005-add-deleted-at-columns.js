'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDescription = await queryInterface.describeTable('users');
    
    // Add deletedAt column to users table if it doesn't exist
    if (!tableDescription.deletedAt) {
      await queryInterface.addColumn('users', 'deletedAt', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    // Add deletedAt column to employees table if it doesn't exist
    const employeesDescription = await queryInterface.describeTable('employees');
    if (!employeesDescription.deletedAt) {
      await queryInterface.addColumn('employees', 'deletedAt', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    // Add deletedAt column to attendances table if it doesn't exist
    const attendancesDescription = await queryInterface.describeTable('attendances');
    if (!attendancesDescription.deletedAt) {
      await queryInterface.addColumn('attendances', 'deletedAt', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const tableDescription = await queryInterface.describeTable('users');
    
    if (tableDescription.deletedAt) {
      await queryInterface.removeColumn('users', 'deletedAt');
    }
    
    const employeesDescription = await queryInterface.describeTable('employees');
    if (employeesDescription.deletedAt) {
      await queryInterface.removeColumn('employees', 'deletedAt');
    }
    
    const attendancesDescription = await queryInterface.describeTable('attendances');
    if (attendancesDescription.deletedAt) {
      await queryInterface.removeColumn('attendances', 'deletedAt');
    }
  },
};

