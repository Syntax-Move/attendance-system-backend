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
  }): Promise<Employee[]> {
    const deletedOnly = filters?.deletedOnly === true;

    const whereClause: any = deletedOnly
      ? { deletedAt: { [Op.ne]: null } }
      : { deletedAt: null };

    // Build user where clause (when not deletedOnly, exclude deleted users)
    const userWhereClause: any = deletedOnly ? {} : { deletedAt: null };

    // Apply filters
    if (filters?.status) {
      whereClause.status = filters.status;
    }

    if (!deletedOnly && filters?.isActive !== undefined) {
      userWhereClause.isActive = filters.isActive;
    }

    if (filters?.designation) {
      whereClause.designation = {
        [Op.iLike]: `%${filters.designation}%`,
      };
    }

    // Search filter (searches in fullName, email, phone, designation) - only for non-deleted list
    if (filters?.search && !deletedOnly) {
      const searchTerm = `%${filters.search}%`;
      
      const employeeFieldsWhere: any = {
        deletedAt: null,
        [Op.or]: [
          { fullName: { [Op.iLike]: searchTerm } },
          { phone: { [Op.iLike]: searchTerm } },
          { designation: { [Op.iLike]: searchTerm } },
        ],
      };
      if (filters?.status) employeeFieldsWhere.status = filters.status;
      if (filters?.designation && !filters.search.includes(filters.designation)) {
        employeeFieldsWhere.designation = { [Op.iLike]: `%${filters.designation}%` };
      }

      const employeesByFields = await this.employeeModel.findAll({
        where: employeeFieldsWhere,
        include: [{ 
          model: User, 
          attributes: ['id', 'email', 'role', 'isActive'],
          where: {
            deletedAt: null,
            ...(filters?.isActive !== undefined ? { isActive: filters.isActive } : {}),
          },
          required: true,
        }],
        order: [['createdAt', 'DESC']],
      });

      const foundIds = employeesByFields.map(emp => emp.id);
      const userEmailWhere: any = {
        deletedAt: null,
        email: { [Op.iLike]: searchTerm },
        ...(filters?.isActive !== undefined ? { isActive: filters.isActive } : {}),
      };
      
      const employeeWhereForEmail: any = {
        deletedAt: null,
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.designation ? { designation: { [Op.iLike]: `%${filters.designation}%` } } : {}),
      };
      
      if (foundIds.length > 0) {
        employeeWhereForEmail.id = { [Op.notIn]: foundIds };
      }

      const employeesByEmail = await this.employeeModel.findAll({
        where: employeeWhereForEmail,
        include: [{ 
          model: User, 
          attributes: ['id', 'email', 'role', 'isActive'],
          where: userEmailWhere,
          required: true,
        }],
        order: [['createdAt', 'DESC']],
      });

      const allEmployees = [...employeesByFields, ...employeesByEmail];
      return allEmployees.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    // Deleted-only list: simple query, include User regardless of deletedAt
    if (deletedOnly) {
      const deletedWhere: any = { deletedAt: { [Op.ne]: null } };
      if (filters?.status) deletedWhere.status = filters.status;
      if (filters?.designation) {
        deletedWhere.designation = { [Op.iLike]: `%${filters.designation}%` };
      }
      return this.employeeModel.findAll({
        where: deletedWhere,
        include: [{ 
          model: User, 
          attributes: ['id', 'email', 'role', 'isActive'],
          required: true,
        }],
        order: [['deletedAt', 'DESC']],
      });
    }

    // Normal query without search
    return this.employeeModel.findAll({
      where: whereClause,
      include: [{ 
        model: User, 
        attributes: ['id', 'email', 'role', 'isActive'],
        where: userWhereClause,
        required: true,
      }],
      order: [['createdAt', 'DESC']],
    });
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

