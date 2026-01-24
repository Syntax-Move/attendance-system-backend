import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/sequelize';
import * as bcrypt from 'bcrypt';
import { User } from '../database/models/user.model';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User)
    private userModel: typeof User,
    private jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto): Promise<LoginResponseDto> {
    const user = await this.userModel.findOne({
      where: { 
        email: loginDto.email,
        deletedAt: null, // Exclude deleted users
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }
    if (user.deletedAt) {
      throw new UnauthorizedException('Account has been deleted');
    }


    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: JwtPayload = {
      sub: user.id,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  async validateUser(userId: string): Promise<User> {
    const user = await this.userModel.findOne({
      where: {
        id: userId,
        deletedAt: null, // Exclude deleted users
      },
    });
    if (!user) {
      throw new UnauthorizedException('User not found or inactive');
    }
    
    if (!user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }
    
    if (user.deletedAt) {
      throw new UnauthorizedException('User account has been deleted');
    }
    return user;
  }
}

