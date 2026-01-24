'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('employees', 'status', {
      type: Sequelize.ENUM('full-time', 'probation', 'notice-period'),
      allowNull: false,
      defaultValue: 'full-time',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('employees', 'status');
    // Note: ENUM type removal might need manual SQL in PostgreSQL
    // await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_employees_status";');
  },
};



