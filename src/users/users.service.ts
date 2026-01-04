import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { User } from '../database/models/user.model';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User)
    private userModel: typeof User,
  ) {}

  async findById(id: string): Promise<User | null> {
    return this.userModel.findByPk(id);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ 
      where: { email },
    });
  }

  async create(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'employee'>): Promise<User> {
    return this.userModel.create(userData as any);
  }
}

