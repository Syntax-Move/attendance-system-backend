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
        'salmanashraf@syntaxmove.com',
        'habibahmed@syntaxmove.com',
        'abdullahawan@syntaxmove.com',
        'harisali@syntaxmove.com',
        'mahzaibkhan@syntaxmove.com',
        'moazzamali@syntaxmove.com',
        'ubaidmalik@syntaxmove.com',
        'safiullahrafeeq@syntaxmove.com',
        'toqeerahmed@syntaxmove.com',
        'muhammadumer@syntaxmove.com',
        'hammadaslam@syntaxmove.com',
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

      // Get current date for joining
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Employee data – all on probation, emails: firstname@syntaxmove.com
      const employeesData = [
        {
          email: 'salmanashraf@syntaxmove.com',
          password: 'password123',
          fullName: 'Salman Ashraf',
          phone: '+92-300-0000001',
          designation: 'Team Member',
          dailySalary: 1500.0,
          joiningDate: today,
          status: 'probation',
        },
        {
          email: 'habibahmed@syntaxmove.com',
          password: 'password123',
          fullName: 'Habib Ahmed',
          phone: '+92-300-0000002',
          designation: 'UI/UX Designer',
          dailySalary: 1500.0,
          joiningDate: today,
          status: 'probation',
        },
        {
          email: 'abdullahawan@syntaxmove.com',
          password: 'password123',
          fullName: 'Abdullah Awan',
          phone: '+92-300-0000003',
          designation: 'WordPress Developer',
          dailySalary: 1500.0,
          joiningDate: today,
          status: 'probation',
        },
        {
          email: 'harisali@syntaxmove.com',
          password: 'password123',
          fullName: 'Haris Ali',
          phone: '+92-300-0000004',
          designation: 'WordPress Developer',
          dailySalary: 1500.0,
          joiningDate: today,
          status: 'probation',
        },
        {
          email: 'mahzaibkhan@syntaxmove.com',
          password: 'password123',
          fullName: 'Mahzaib Khan',
          phone: '+92-300-0000005',
          designation: 'WordPress Developer',
          dailySalary: 1500.0,
          joiningDate: today,
          status: 'probation',
        },
        {
          email: 'moazzamali@syntaxmove.com',
          password: 'password123',
          fullName: 'Moazzam Ali',
          phone: '+92-300-0000006',
          designation: 'Graphics Designer',
          dailySalary: 1500.0,
          joiningDate: today,
          status: 'probation',
        },
        {
          email: 'ubaidmalik@syntaxmove.com',
          password: 'password123',
          fullName: 'Ubaid Malik',
          phone: '+92-300-0000007',
          designation: 'Full Stack Developer',
          dailySalary: 1800.0,
          joiningDate: today,
          status: 'probation',
        },
        {
          email: 'safiullahrafeeq@syntaxmove.com',
          password: 'password123',
          fullName: 'Safiullah Rafeeq',
          phone: '+92-300-0000008',
          designation: 'Full Stack Developer',
          dailySalary: 1800.0,
          joiningDate: today,
          status: 'probation',
        },
        {
          email: 'toqeerahmed@syntaxmove.com',
          password: 'password123',
          fullName: 'Toqeer Ahmed',
          phone: '+92-300-0000009',
          designation: 'Floor Manager & QA Assistant',
          dailySalary: 1500.0,
          joiningDate: today,
          status: 'probation',
        },
        {
          email: 'muhammadumer@syntaxmove.com',
          password: 'password123',
          fullName: 'Muhammad Umer',
          phone: '+92-300-0000010',
          designation: 'Jr. WordPress Developer',
          dailySalary: 1200.0,
          joiningDate: today,
          status: 'probation',
        },
        {
          email: 'hammadaslam@syntaxmove.com',
          password: 'password123',
          fullName: 'Hammad Aslam',
          phone: '+92-300-0000011',
          designation: 'UI/UX Designer',
          dailySalary: 1500.0,
          joiningDate: today,
          status: 'probation',
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
        `   - Probation: ${employeesData.filter(e => e.status === 'probation').length}`,
      );
      this.logger.log(
        `   - Salary Range: Rs.${Math.min(...employeesData.map(e => e.dailySalary * 22)).toLocaleString()} - Rs.${Math.max(...employeesData.map(e => e.dailySalary * 22)).toLocaleString()} per month`,
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

