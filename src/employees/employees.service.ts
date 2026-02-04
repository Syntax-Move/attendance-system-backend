import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Op } from 'sequelize';
import { UniqueConstraintError } from 'sequelize';
import * as bcrypt from 'bcrypt';
import { Employee } from '../database/models/employee.model';
import { User } from '../database/models/user.model';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { LeaveBalanceUtil } from '../common/utils/leave-balance.util';
import { WorkingDaysUtil } from '../common/utils/working-days.util';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectModel(Employee)
    private employeeModel: typeof Employee,
    @InjectModel(User)
    private userModel: typeof User,
    private sequelize: Sequelize,
    private leaveBalanceUtil: LeaveBalanceUtil,
  ) {}

  async findAll(filters?: {
    search?: string;
    status?: string;
    isActive?: boolean;
    designation?: string;
    deletedOnly?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ data: Employee[]; total: number }> {
    const deletedOnly = filters?.deletedOnly === true;
    const page = Math.max(1, filters?.page ?? 1);
    const limit = Math.min(500, Math.max(1, filters?.limit ?? 20));
    const offset = (page - 1) * limit;

    const whereClause: any = deletedOnly
      ? { deletedAt: { [Op.ne]: null } }
      : { deletedAt: null };

    const userWhereClause: any = deletedOnly ? {} : { deletedAt: null };

    if (filters?.status) whereClause.status = filters.status;
    if (!deletedOnly && filters?.isActive !== undefined) userWhereClause.isActive = filters.isActive;
    if (filters?.designation) whereClause.designation = { [Op.iLike]: `%${filters.designation}%` };

    const includeUser = [
      {
        model: User,
        attributes: ['id', 'email', 'role', 'isActive'],
        where: userWhereClause,
        required: true,
      },
    ];

    // Search: single query with OR (employee fields or user email)
    if (filters?.search && !deletedOnly) {
      const searchTerm = `%${filters.search}%`;
      const searchWhere: any = {
        deletedAt: null,
        [Op.or]: [
          { fullName: { [Op.iLike]: searchTerm } },
          { phone: { [Op.iLike]: searchTerm } },
          { designation: { [Op.iLike]: searchTerm } },
          this.sequelize.where(this.sequelize.col('user.email'), { [Op.iLike]: searchTerm }),
        ],
      };
      if (filters?.status) searchWhere.status = filters.status;
      if (filters?.designation) searchWhere.designation = { [Op.iLike]: `%${filters.designation}%` };

      const total = await this.employeeModel.count({
        where: searchWhere,
        include: includeUser,
        distinct: true,
      });
      const data = await this.employeeModel.findAll({
        where: searchWhere,
        include: includeUser,
        order: [['createdAt', 'DESC']],
        limit,
        offset,
      });
      return { data, total };
    }

    // Deleted-only list
    if (deletedOnly) {
      const deletedWhere: any = { deletedAt: { [Op.ne]: null } };
      if (filters?.status) deletedWhere.status = filters.status;
      if (filters?.designation) deletedWhere.designation = { [Op.iLike]: `%${filters.designation}%` };
      const includeDeletedUser = [{ model: User, attributes: ['id', 'email', 'role', 'isActive'], required: true }];
      const total = await this.employeeModel.count({
        where: deletedWhere,
        include: includeDeletedUser,
        distinct: true,
      });
      const data = await this.employeeModel.findAll({
        where: deletedWhere,
        include: includeDeletedUser,
        order: [['deletedAt', 'DESC']],
        limit,
        offset,
      });
      return { data, total };
    }

    // Normal query
    const total = await this.employeeModel.count({
      where: whereClause,
      include: includeUser,
      distinct: true,
    });
    const data = await this.employeeModel.findAll({
      where: whereClause,
      include: includeUser,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });
    return { data, total };
  }

  async findById(id: string): Promise<Employee> {
    const employee = await this.employeeModel.findOne({
      where: {
        id,
        deletedAt: null, // Exclude deleted employees
      },
      include: [{ 
        model: User, 
        attributes: ['id', 'email', 'role', 'isActive'],
        where: {
          deletedAt: null, // Exclude deleted users
        },
        required: true,
      }],
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    return employee;
  }

  async findByUserId(userId: string): Promise<Employee> {
    const employee = await this.employeeModel.findOne({
      where: { 
        userId,
        deletedAt: null, // Exclude deleted employees
      },
      include: [{ 
        model: User, 
        attributes: ['id', 'email', 'role', 'isActive'],
        where: {
          id: userId,
          deletedAt: null, // Exclude deleted users
        },
        required: true,
      }],
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    return employee;
  }

  async create(createEmployeeDto: CreateEmployeeDto): Promise<Employee> {
    const transaction = await this.sequelize.transaction();

    try {
      // Check if user with email already exists (including deleted)
      const existingUser = await this.userModel.findOne({
        where: { 
          email: createEmployeeDto.email,
          deletedAt: null, // Only check non-deleted users
        },
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

      // Calculate daily salary from monthly salary based on working days in joining month
      const joiningDate = new Date(createEmployeeDto.joiningDate);
      const joiningMonth = joiningDate.getMonth() + 1;
      const joiningYear = joiningDate.getFullYear();
      const dailySalary = WorkingDaysUtil.calculateDailySalary(
        createEmployeeDto.monthlySalary,
        joiningMonth,
        joiningYear,
      );

      // Create employee
      const employee = await this.employeeModel.create(
        {
          userId: user.id,
          fullName: createEmployeeDto.fullName,
          phone: createEmployeeDto.phone,
          designation: createEmployeeDto.designation,
          dailySalary: dailySalary,
          joiningDate: joiningDate,
          status: createEmployeeDto.status || 'full-time',
        } as any,
        { transaction },
      );

      await transaction.commit();

      // Initialize leave balance for the employee
      await this.leaveBalanceUtil.initializeLeaveBalance(
        employee.id,
        new Date(createEmployeeDto.joiningDate),
      );

      return this.findById(employee.id);
    } catch (error) {
      await transaction.rollback();
      if (error instanceof UniqueConstraintError && error.fields?.email) {
        throw new BadRequestException('A user with this email already exists.');
      }
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
    if (updateEmployeeDto.status !== undefined) {
      updateData.status = updateEmployeeDto.status;
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

  async delete(id: string): Promise<{ message: string }> {
    const employee = await this.findById(id);
    
    // Soft delete employee
    await employee.update({ deletedAt: new Date() });
    
    // Also soft delete associated user
    const user = await this.userModel.findByPk(employee.userId);
    if (user) {
      await user.update({ deletedAt: new Date() });
    }

    return { message: 'Employee deleted successfully' };
  }

  async restore(id: string): Promise<Employee> {
    const employee = await this.employeeModel.findOne({
      where: { id },
      include: [{ model: User, attributes: ['id', 'email', 'role', 'isActive'], required: true }],
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    if (employee.deletedAt == null) {
      throw new BadRequestException('Employee is not deleted');
    }

    await employee.update({ deletedAt: null });
    const user = await this.userModel.findByPk(employee.userId);
    if (user) {
      await user.update({ deletedAt: null, isActive: true });
    }

    return this.findById(id);
  }
}

