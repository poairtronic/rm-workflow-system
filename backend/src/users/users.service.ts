import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import bcrypt from 'bcryptjs';
import { User } from './entities/user.entity.js';
import { Role } from '../roles/entities/role.entity.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const existingUser = await this.userRepository.findOne({
      where: { email: createUserDto.email.toLowerCase().trim() },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const role = await this.roleRepository.findOne({
      where: { name: createUserDto.role },
    });

    if (!role) {
      throw new BadRequestException(`Role ${createUserDto.role} not found`);
    }

    const passwordHash = await bcrypt.hash(createUserDto.password, 10);

    const user = this.userRepository.create({
      name: createUserDto.name,
      email: createUserDto.email.toLowerCase().trim(),
      passwordHash,
      roleId: role.id,
      department: createUserDto.department,
      isActive: true,
    });

    const savedUser = await this.userRepository.save(user);
    // Remove passwordHash from response
    const { passwordHash: _, ...result } = savedUser;
    return { ...result, role };
  }

  async findAll() {
    return this.userRepository.find({
      relations: { role: true },
      select: {
        id: true,
        name: true,
        email: true,
        department: true,
        isActive: true,
        roleId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findOne(id: string) {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: { role: true },
      select: {
        id: true,
        name: true,
        email: true,
        department: true,
        isActive: true,
        roleId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    if (updateUserDto.email) {
      const existingUser = await this.userRepository.findOne({
        where: { email: updateUserDto.email.toLowerCase().trim() },
      });
      if (existingUser && existingUser.id !== id) {
        throw new ConflictException('Email already exists');
      }
      user.email = updateUserDto.email.toLowerCase().trim();
    }

    if (updateUserDto.role) {
      const role = await this.roleRepository.findOne({
        where: { name: updateUserDto.role },
      });
      if (!role) {
        throw new BadRequestException(`Role ${updateUserDto.role} not found`);
      }
      user.roleId = role.id;
    }

    if (updateUserDto.password) {
      user.passwordHash = await bcrypt.hash(updateUserDto.password, 10);
    }

    if (updateUserDto.name !== undefined) {
      user.name = updateUserDto.name;
    }

    if (updateUserDto.department !== undefined) {
      user.department = updateUserDto.department;
    }

    const updatedUser = await this.userRepository.save(user);
    const { passwordHash: _, ...result } = updatedUser;
    return result;
  }

  async deactivate(id: string) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    user.isActive = false;
    await this.userRepository.save(user);
    return { success: true, message: `User ${id} deactivated` };
  }

  async activate(id: string) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    user.isActive = true;
    await this.userRepository.save(user);
    return { success: true, message: `User ${id} activated` };
  }
}
