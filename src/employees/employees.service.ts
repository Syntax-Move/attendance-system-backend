import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import * as bcrypt from 'bcrypt';
import { Employee } from '../database/models/employee.model';
import { User } from '../database/models/user.model';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectModel(Employee)
    private employeeModel: typeof Employee,
    @InjectModel(User)
    private userModel: typeof User,
    private sequelize: Sequelize,
  ) {}

  async findAll(): Promise<Employee[]> {
    return this.employeeModel.findAll({
      include: [{ model: User, attributes: ['id', 'email', 'role', 'isActive'] }],
      order: [['createdAt', 'DESC']],
    });
  }

  async findById(id: string): Promise<Employee> {
    const employee = await this.employeeModel.findByPk(id, {
      include: [{ model: User, attributes: ['id', 'email', 'role', 'isActive'] }],
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    return employee;
  }

  async findByUserId(userId: string): Promise<Employee> {
    const employee = await this.employeeModel.findOne({
      where: { userId },
      include: [{ model: User, attributes: ['id', 'email', 'role', 'isActive'] }],
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    return employee;
  }

  async create(createEmployeeDto: CreateEmployeeDto): Promise<Employee> {
    const transaction = await this.sequelize.transaction();

    try {
      // Check if user with email already exists
      const existingUser = await this.userModel.findOne({
        where: { email: createEmployeeDto.email },
        transaction,
      });

      if (existingUser) {
        throw new BadRequestException('User with this email already exists');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(createEmployeeDto.password, 10);

      // Create user
      const user = await this.userModel.create(
        {
          email: createEmployeeDto.email,
          passwordHash,
          role: createEmployeeDto.role,
          isActive: true,
        } as any,
        { transaction },
      );

      // Create employee
      const employee = await this.employeeModel.create(
        {
          userId: user.id,
          fullName: createEmployeeDto.fullName,
          phone: createEmployeeDto.phone,
          designation: createEmployeeDto.designation,
          dailySalary: createEmployeeDto.dailySalary,
          joiningDate: new Date(createEmployeeDto.joiningDate),
        } as any,
        { transaction },
      );

      await transaction.commit();

      return this.findById(employee.id);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async update(id: string, updateEmployeeDto: UpdateEmployeeDto): Promise<Employee> {
    const employee = await this.findById(id);

    const updateData: any = {};
    if (updateEmployeeDto.fullName !== undefined) {
      updateData.fullName = updateEmployeeDto.fullName;
    }
    if (updateEmployeeDto.phone !== undefined) {
      updateData.phone = updateEmployeeDto.phone;
    }
    if (updateEmployeeDto.designation !== undefined) {
      updateData.designation = updateEmployeeDto.designation;
    }
    if (updateEmployeeDto.dailySalary !== undefined) {
      updateData.dailySalary = updateEmployeeDto.dailySalary;
    }
    if (updateEmployeeDto.joiningDate !== undefined) {
      updateData.joiningDate = new Date(updateEmployeeDto.joiningDate);
    }

    await employee.update(updateData);

    // Update user's isActive if provided
    if (updateEmployeeDto.isActive !== undefined) {
      const user = await this.userModel.findByPk(employee.userId);
      if (user) {
        await user.update({ isActive: updateEmployeeDto.isActive });
      }
    }

    return this.findById(id);
  }

  async deactivate(id: string): Promise<Employee> {
    const employee = await this.findById(id);

    // Deactivate user (isActive is only in User model)
    const user = await this.userModel.findByPk(employee.userId);
    if (user) {
      await user.update({ isActive: false });
    }

    return this.findById(id);
  }
}

