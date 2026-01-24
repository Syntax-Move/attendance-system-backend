'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add createdAt column to salary_deduction_ledgers table
    await queryInterface.addColumn('salary_deduction_ledgers', 'createdAt', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('salary_deduction_ledgers', 'createdAt');
  },
};



