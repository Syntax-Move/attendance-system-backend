'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      const attendancesDesc = await queryInterface.describeTable('attendances');
      if (!attendancesDesc.isLate) {
        await queryInterface.addColumn('attendances', 'isLate', {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        });
      }
      if (!attendancesDesc.isHalfDay) {
        await queryInterface.addColumn('attendances', 'isHalfDay', {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        });
      }
    } catch (e) {
      console.warn('attendances isLate/isHalfDay:', e.message);
    }

    try {
      const leaveRequestsDesc = await queryInterface.describeTable('leave_requests');
      if (!leaveRequestsDesc.days) {
        await queryInterface.addColumn('leave_requests', 'days', {
          type: Sequelize.DECIMAL(4, 2),
          allowNull: true,
          comment: 'Leave in days (0.5, 1, 1.5, ...). 1 day = full working day. If null, use hours/9.',
        });
      }
      if (!leaveRequestsDesc.unpaidDays) {
        await queryInterface.addColumn('leave_requests', 'unpaidDays', {
          type: Sequelize.DECIMAL(4, 2),
          allowNull: true,
          defaultValue: 0,
          comment: 'Excess days beyond leave balance (deducted from salary)',
        });
      }
    } catch (e) {
      console.warn('leave_requests days/unpaidDays:', e.message);
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      const attendancesDesc = await queryInterface.describeTable('attendances');
      if (attendancesDesc.isLate) await queryInterface.removeColumn('attendances', 'isLate');
      if (attendancesDesc.isHalfDay) await queryInterface.removeColumn('attendances', 'isHalfDay');
    } catch (e) {
      console.warn('attendances down:', e.message);
    }
    try {
      const leaveRequestsDesc = await queryInterface.describeTable('leave_requests');
      if (leaveRequestsDesc.days) await queryInterface.removeColumn('leave_requests', 'days');
      if (leaveRequestsDesc.unpaidDays) await queryInterface.removeColumn('leave_requests', 'unpaidDays');
    } catch (e) {
      console.warn('leave_requests down:', e.message);
    }
  },
};
