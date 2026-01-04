import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { User } from '../models/user.model';
import { UserRole } from '../../common/enums/user-role.enum';

@Injectable()
export class CreateAdminUserSeed implements OnModuleInit {
  private readonly logger = new Logger(CreateAdminUserSeed.name);

  constructor(
    @InjectModel(User)
    private userModel: typeof User,
    private configService: ConfigService,
  ) {}

  async onModuleInit() {
    await this.createAdminUser();
  }

  async createAdminUser() {
    try {
      // Check if admin user already exists
      const existingAdmin = await this.userModel.findOne({
        where: { role: UserRole.ADMIN },
      });

      if (existingAdmin) {
        this.logger.log('Admin user already exists. Skipping seed.');
        return;
      }

      // Get admin credentials from environment or use defaults
      const adminEmail =
        this.configService.get<string>('ADMIN_EMAIL') || 'admin@example.com';
      const adminPassword =
        this.configService.get<string>('ADMIN_PASSWORD') || 'admin123';

      // Check if user with this email exists
      const existingUser = await this.userModel.findOne({
        where: { email: adminEmail },
      });

      if (existingUser) {
        this.logger.warn(
          `User with email ${adminEmail} already exists but is not an admin. Skipping seed.`,
        );
        return;
      }

      // Hash password
      const passwordHash = await bcrypt.hash(adminPassword, 10);

      // Create admin user
      const adminUser = await this.userModel.create({
        email: adminEmail,
        passwordHash,
        role: UserRole.ADMIN,
        isActive: true,
      } as any);

      this.logger.log(
        `Admin user created successfully with email: ${adminEmail}`,
      );
      this.logger.warn(
        `⚠️  IMPORTANT: Change the default admin password in production!`,
      );
      this.logger.warn(
        `Default credentials - Email: ${adminEmail}, Password: ${adminPassword}`,
      );
    } catch (error) {
      this.logger.error('Error creating admin user:', error);
      throw error;
    }
  }
}

