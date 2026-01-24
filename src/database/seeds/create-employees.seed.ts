import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import * as bcrypt from 'bcrypt';
import { User } from '../models/user.model';
import { Employee } from '../models/employee.model';
import { LeaveBalance } from '../models/leave-balance.model';
import { UserRole } from '../../common/enums/user-role.enum';

@Injectable()
export class CreateEmployeesSeed implements OnModuleInit {
  private readonly logger = new Logger(CreateEmployeesSeed.name);

  constructor(
    @InjectModel(User)
    private userModel: typeof User,
    @InjectModel(Employee)
    private employeeModel: typeof Employee,
    @InjectModel(LeaveBalance)
    private leaveBalanceModel: typeof LeaveBalance,
    private sequelize: Sequelize,
  ) {}

  async onModuleInit() {
    // Only run if explicitly called via seed script
    // This prevents auto-running on app start
  }

  async createEmployees() {
    const transaction = await this.sequelize.transaction();

    try {
      // Check if all seed employees already exist
      const seedEmails = [
        'john.doe@example.com',
        'jane.smith@example.com',
        'mike.johnson@example.com',
        'sarah.williams@example.com',
        'david.brown@example.com',
        'emily.davis@example.com',
        'robert.miller@example.com',
        'lisa.wilson@example.com',
        'james.moore@example.com',
        'patricia.taylor@example.com',
      ];

      const existingUsers = await this.userModel.findAll({
        where: { email: seedEmails },
        transaction,
      });

      if (existingUsers.length === seedEmails.length) {
        this.logger.log(
          `All seed employees already exist (${existingUsers.length}). Skipping seed.`,
        );
        await transaction.rollback();
        return;
      }

      if (existingUsers.length > 0) {
        this.logger.log(
          `Found ${existingUsers.length} existing seed employees. Will create remaining ones.`,
        );
      }

      // Get current date for varied joining dates
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const threeDaysAgo = new Date(today);
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const fiveDaysAgo = new Date(today);
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);

      const twoWeeksAgo = new Date(today);
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

      const monthAgo = new Date(today);
      monthAgo.setDate(monthAgo.getDate() - 30);

      const twoMonthsAgo = new Date(today);
      twoMonthsAgo.setDate(twoMonthsAgo.getDate() - 60);

      // Employee data with varied joining dates and comprehensive information
      const employeesData = [
        {
          email: 'john.doe@example.com',
          password: 'password123',
          fullName: 'John Doe',
          phone: '+1-555-0101',
          designation: 'Senior Software Developer',
          dailySalary: 1500.0, // Monthly: 33,000 (1500 × 22)
          joiningDate: today,
          status: 'full-time',
        },
        {
          email: 'jane.smith@example.com',
          password: 'password123',
          fullName: 'Jane Smith',
          phone: '+1-555-0102',
          designation: 'Product Manager',
          dailySalary: 2000.0, // Monthly: 44,000 (2000 × 22)
          joiningDate: yesterday,
          status: 'full-time',
        },
        {
          email: 'mike.johnson@example.com',
          password: 'password123',
          fullName: 'Mike Johnson',
          phone: '+1-555-0103',
          designation: 'UI/UX Designer',
          dailySalary: 1200.0, // Monthly: 26,400 (1200 × 22)
          joiningDate: tomorrow,
          status: 'probation',
        },
        {
          email: 'sarah.williams@example.com',
          password: 'password123',
          fullName: 'Sarah Williams',
          phone: '+1-555-0104',
          designation: 'Backend Developer',
          dailySalary: 1400.0, // Monthly: 30,800 (1400 × 22)
          joiningDate: threeDaysAgo,
          status: 'full-time',
        },
        {
          email: 'david.brown@example.com',
          password: 'password123',
          fullName: 'David Brown',
          phone: '+1-555-0105',
          designation: 'DevOps Engineer',
          dailySalary: 1600.0, // Monthly: 35,200 (1600 × 22)
          joiningDate: fiveDaysAgo,
          status: 'full-time',
        },
        {
          email: 'emily.davis@example.com',
          password: 'password123',
          fullName: 'Emily Davis',
          phone: '+1-555-0106',
          designation: 'QA Engineer',
          dailySalary: 1100.0, // Monthly: 24,200 (1100 × 22)
          joiningDate: weekAgo,
          status: 'probation',
        },
        {
          email: 'robert.miller@example.com',
          password: 'password123',
          fullName: 'Robert Miller',
          phone: '+1-555-0107',
          designation: 'Frontend Developer',
          dailySalary: 1300.0, // Monthly: 28,600 (1300 × 22)
          joiningDate: twoWeeksAgo,
          status: 'full-time',
        },
        {
          email: 'lisa.wilson@example.com',
          password: 'password123',
          fullName: 'Lisa Wilson',
          phone: '+1-555-0108',
          designation: 'Business Analyst',
          dailySalary: 1800.0, // Monthly: 39,600 (1800 × 22)
          joiningDate: monthAgo,
          status: 'full-time',
        },
        {
          email: 'james.moore@example.com',
          password: 'password123',
          fullName: 'James Moore',
          phone: '+1-555-0109',
          designation: 'Technical Lead',
          dailySalary: 2500.0, // Monthly: 55,000 (2500 × 22)
          joiningDate: twoMonthsAgo,
          status: 'full-time',
        },
        {
          email: 'patricia.taylor@example.com',
          password: 'password123',
          fullName: 'Patricia Taylor',
          phone: '+1-555-0110',
          designation: 'HR Manager',
          dailySalary: 1700.0, // Monthly: 37,400 (1700 × 22)
          joiningDate: today,
          status: 'notice-period',
        },
      ];

      let createdCount = 0;

      for (const empData of employeesData) {
        try {
          // Check if user with this email already exists
          const existingUser = await this.userModel.findOne({
            where: { email: empData.email },
            transaction,
          });

          if (existingUser) {
            this.logger.warn(
              `User with email ${empData.email} already exists. Skipping.`,
            );
            continue;
          }

          // Hash password
          const passwordHash = await bcrypt.hash(empData.password, 10);

          // Create user
          const user = await this.userModel.create(
            {
              email: empData.email,
              passwordHash,
              role: UserRole.EMPLOYEE,
              isActive: true,
            } as any,
            { transaction },
          );

          // Create employee
          const employee = await this.employeeModel.create(
            {
              userId: user.id,
              fullName: empData.fullName,
              phone: empData.phone,
              designation: empData.designation,
              dailySalary: empData.dailySalary,
              joiningDate: empData.joiningDate,
              status: empData.status,
            } as any,
            { transaction },
          );

          // Initialize leave balance based on joining date
          const joinDate = new Date(empData.joiningDate);
          const month = joinDate.getMonth() + 1;
          const year = joinDate.getFullYear();
          
          // Create leave balance record directly within transaction
          await this.leaveBalanceModel.findOrCreate({
            where: {
              employeeId: employee.id,
              month,
              year,
            },
            defaults: {
              employeeId: employee.id,
              month,
              year,
              balanceMinutes: 15 * 60, // 15 hours = 900 minutes
              utilizedMinutes: 0,
              carryoverMinutes: 0,
            } as any,
            transaction,
          });

          createdCount++;
          this.logger.log(
            `Created employee: ${empData.fullName} (${empData.email}) - Joined: ${empData.joiningDate.toISOString().split('T')[0]}`,
          );
        } catch (error) {
          this.logger.error(
            `Error creating employee ${empData.email}:`,
            error.message,
          );
          // Continue with next employee
        }
      }

      await transaction.commit();
      this.logger.log(
        `✅ Successfully created ${createdCount} employees with leave balances!`,
      );
      this.logger.log(
        `📊 Employee Summary:`,
      );
      this.logger.log(
        `   - Full-time: ${employeesData.filter(e => e.status === 'full-time').length}`,
      );
      this.logger.log(
        `   - Probation: ${employeesData.filter(e => e.status === 'probation').length}`,
      );
      this.logger.log(
        `   - Notice Period: ${employeesData.filter(e => e.status === 'notice-period').length}`,
      );
      this.logger.log(
        `   - Salary Range: $${Math.min(...employeesData.map(e => e.dailySalary * 22)).toFixed(2)} - $${Math.max(...employeesData.map(e => e.dailySalary * 22)).toFixed(2)} per month`,
      );
      this.logger.warn(
        `⚠️  All employees have default password: password123 - Change in production!`,
      );
      this.logger.log(
        `📧 Employee emails: ${employeesData.map(e => e.email).join(', ')}`,
      );
    } catch (error) {
      await transaction.rollback();
      this.logger.error('Error creating employees:', error);
      throw error;
    }
  }
}

