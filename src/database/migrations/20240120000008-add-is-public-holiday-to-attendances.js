'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check and add isPublicHoliday field to attendances table if it doesn't exist
    try {
      const attendancesDesc = await queryInterface.describeTable('attendances');
      if (!attendancesDesc.isPublicHoliday) {
        await queryInterface.addColumn('attendances', 'isPublicHoliday', {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
          comment: 'True if this is a public holiday',
        });
      }
    } catch (error) {
      // Table might not exist yet (created via sync), skip
      console.warn('Could not check attendances table:', error.message);
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      const attendancesDesc = await queryInterface.describeTable('attendances');
      if (attendancesDesc.isPublicHoliday) {
        await queryInterface.removeColumn('attendances', 'isPublicHoliday');
      }
    } catch (error) {
      console.warn('Could not remove isPublicHoliday column:', error.message);
    }
  },
};

