'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('public_holidays', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },
      date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        unique: true,
        comment: 'Date of the public holiday (YYYY-MM-DD)',
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Name/description of the holiday',
      },
      description: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Optional description or notes',
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

    // Add index on date for faster lookups
    await queryInterface.addIndex('public_holidays', ['date'], {
      unique: true,
      name: 'public_holidays_date_unique',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('public_holidays');
  },
};

