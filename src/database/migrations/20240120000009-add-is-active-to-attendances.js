'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      const attendancesDesc = await queryInterface.describeTable('attendances');
      if (!attendancesDesc.isActive) {
        await queryInterface.addColumn('attendances', 'isActive', {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
          comment: 'True if this attendance record is active (has check-in or is past date)',
        });
      }
    } catch (error) {
      // Table might not exist yet (created via sync), skip
      console.warn('Could not check attendances table:', error.message);
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      const attendancesDesc = await queryInterface.describeTable('attendances');
      if (attendancesDesc.isActive) {
        await queryInterface.removeColumn('attendances', 'isActive');
      }
    } catch (error) {
      console.warn('Could not remove isActive column:', error.message);
    }
  },
};

