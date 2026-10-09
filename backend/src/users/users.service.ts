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
import { UserRole } from '../auth/enums/role.enum.js';

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

    const rawPassword =
      createUserDto.password ||
      process.env.SEED_DEFAULT_PASSWORD ||
      'airtronic123A@';
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    const user = this.userRepository.create({
      name: createUserDto.name.trim(),
      email: createUserDto.email.toLowerCase().trim(),
      passwordHash,
      roleId: role.id,
      department: createUserDto.department?.trim() || undefined,
      isActive:
        createUserDto.isActive !== undefined ? createUserDto.isActive : true,
    });

    const savedUser = await this.userRepository.save(user);
    // Never expose passwordHash
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
      order: {
        createdAt: 'DESC',
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

  async toggleActive(
    id: string,
    explicitActive?: boolean,
    currentUserId?: string,
  ) {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: { role: true },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const nextActive =
      explicitActive !== undefined ? explicitActive : !user.isActive;

    if (
      !nextActive &&
      currentUserId &&
      (currentUserId === user.id || currentUserId === id)
    ) {
      throw new BadRequestException(
        'Administrators cannot deactivate their own account',
      );
    }

    user.isActive = nextActive;
    await this.userRepository.save(user);
    const { passwordHash: _, ...result } = user;
    return result;
  }

  async updateRole(id: string, roleName: UserRole) {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: { role: true },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const role = await this.roleRepository.findOne({
      where: { name: roleName },
    });
    if (!role) {
      throw new BadRequestException(`Role ${roleName} not found`);
    }

    user.roleId = role.id;
    await this.userRepository.save(user);
    const { passwordHash: _, ...result } = user;
    return { ...result, role };
  }

  async deactivate(id: string, currentUserId?: string) {
    if (currentUserId && currentUserId === id) {
      throw new BadRequestException(
        'Administrators cannot deactivate their own account',
      );
    }
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    if (currentUserId && currentUserId === user.id) {
      throw new BadRequestException(
        'Administrators cannot deactivate their own account',
      );
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

  async resetPassword(id: string, newPassword?: string) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const passwordToSet =
      newPassword || process.env.SEED_DEFAULT_PASSWORD || 'airtronic123A@';
    user.passwordHash = await bcrypt.hash(passwordToSet, 10);
    await this.userRepository.save(user);

    return {
      success: true,
      message: `Password for user ${user.email} reset successfully`,
    };
  }
}
