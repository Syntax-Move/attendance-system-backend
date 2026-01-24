'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check and add unpaidLeave field to attendances table if it doesn't exist
    try {
      const attendancesDesc = await queryInterface.describeTable('attendances');
      if (!attendancesDesc.unpaidLeave) {
        await queryInterface.addColumn('attendances', 'unpaidLeave', {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
          comment: 'True if this is an unpaid leave day (no check-in/check-out)',
        });
      }
    } catch (error) {
      // Table might not exist yet (created via sync), skip
      console.warn('Could not check attendances table:', error.message);
    }

    // Check and add unpaidHours field to leave_requests table if it doesn't exist
    try {
      const leaveRequestsDesc = await queryInterface.describeTable('leave_requests');
      if (!leaveRequestsDesc.unpaidHours) {
        await queryInterface.addColumn('leave_requests', 'unpaidHours', {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
          comment: 'Number of unpaid hours (when leave balance is insufficient)',
        });
      }
    } catch (error) {
      // Table might not exist yet (created via sync), skip
      console.warn('Could not check leave_requests table:', error.message);
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      const attendancesDesc = await queryInterface.describeTable('attendances');
      if (attendancesDesc.unpaidLeave) {
        await queryInterface.removeColumn('attendances', 'unpaidLeave');
      }
    } catch (error) {
      console.warn('Could not remove unpaidLeave column:', error.message);
    }

    try {
      const leaveRequestsDesc = await queryInterface.describeTable('leave_requests');
      if (leaveRequestsDesc.unpaidHours) {
        await queryInterface.removeColumn('leave_requests', 'unpaidHours');
      }
    } catch (error) {
      console.warn('Could not remove unpaidHours column:', error.message);
    }
  },
};

