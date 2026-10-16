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

  async deleteUser(
    id: string,
    currentUserId?: string,
    forceOrReassign = false,
  ) {
    if (currentUserId && currentUserId === id) {
      throw new BadRequestException(
        'Administrators cannot delete their own account.',
      );
    }

    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Determine an active fallback admin to receive ownership if needed
    let targetAdminId = currentUserId;
    if (!targetAdminId) {
      try {
        const adminRes = await this.userRepository.manager.query(
          `SELECT u.id FROM users u 
           JOIN roles r ON u.role_id = r.id 
           WHERE r.name = 'ADMIN' AND u.is_active = true AND u.id != $1 
           ORDER BY u.created_at ASC LIMIT 1`,
          [id],
        );
        targetAdminId = adminRes[0]?.id;
      } catch {
        // Fallback
      }
    }

    // Check if user is author/creator/issuer of critical transactional records
    const checkQueries = [
      { name: 'Stock Transactions', sql: `SELECT COUNT(*)::int as c FROM stock_transactions WHERE created_by_id = $1` },
      { name: 'Delivery Challans', sql: `SELECT COUNT(*)::int as c FROM delivery_challans WHERE created_by_id = $1 OR verified_by_id = $1` },
      { name: 'RM Requisitions', sql: `SELECT COUNT(*)::int as c FROM rm_requests WHERE created_by_id = $1 OR reviewed_by_id = $1` },
      { name: 'RM Item Snapshots', sql: `SELECT COUNT(*)::int as c FROM rm_item_snapshots WHERE changed_by_id = $1` },
      { name: 'Material Issues', sql: `SELECT COUNT(*)::int as c FROM material_issues WHERE issued_by_id = $1` },
      { name: 'General Issues', sql: `SELECT COUNT(*)::int as c FROM general_issues WHERE issued_by_id = $1` },
      { name: 'Material Receipts', sql: `SELECT COUNT(*)::int as c FROM material_receipts WHERE received_by_id = $1` },
      { name: 'Material Consumptions', sql: `SELECT COUNT(*)::int as c FROM material_consumptions WHERE recorded_by_id = $1` },
      { name: 'Material Returns', sql: `SELECT COUNT(*)::int as c FROM material_returns WHERE returned_by_id = $1 OR confirmed_by_id = $1` },
      { name: 'Sales Order Components', sql: `SELECT COUNT(*)::int as c FROM sales_order_components WHERE completed_by_id = $1` },
      { name: 'Additional Requests', sql: `SELECT COUNT(*)::int as c FROM additional_material_requests WHERE requested_by_id = $1 OR approved_by_id = $1` },
    ];

    let totalRefs = 0;
    const refBreakdown: string[] = [];

    for (const q of checkQueries) {
      try {
        const res = await this.userRepository.manager.query(q.sql, [id]);
        const count = Number(res[0]?.c || 0);
        if (count > 0) {
          totalRefs += count;
          refBreakdown.push(`${count} ${q.name}`);
        }
      } catch {
        // Table or column may not exist in certain environments
      }
    }

    if (totalRefs > 0) {
      if (!forceOrReassign) {
        throw new BadRequestException(
          `Cannot delete user "${user.name}" (${user.email}) because they authored historical records (${refBreakdown.join(', ')}). You can reassign these records to your admin account and delete, or deactivate the account instead.`,
        );
      }

      if (!targetAdminId) {
        throw new BadRequestException(
          'An active administrator account is required to reassign historical records during deletion.',
        );
      }

      // Reassign historical records to administrator so business integrity is preserved
      const reassignQueries = [
        `UPDATE stock_transactions SET created_by_id = $2 WHERE created_by_id = $1`,
        `UPDATE delivery_challans SET created_by_id = $2 WHERE created_by_id = $1`,
        `UPDATE delivery_challans SET verified_by_id = $2 WHERE verified_by_id = $1`,
        `UPDATE rm_requests SET created_by_id = $2 WHERE created_by_id = $1`,
        `UPDATE rm_requests SET reviewed_by_id = $2 WHERE reviewed_by_id = $1`,
        `UPDATE rm_item_snapshots SET changed_by_id = $2 WHERE changed_by_id = $1`,
        `UPDATE material_issues SET issued_by_id = $2 WHERE issued_by_id = $1`,
        `UPDATE general_issues SET issued_by_id = $2 WHERE issued_by_id = $1`,
        `UPDATE material_receipts SET received_by_id = $2 WHERE received_by_id = $1`,
        `UPDATE material_consumptions SET recorded_by_id = $2 WHERE recorded_by_id = $1`,
        `UPDATE material_returns SET returned_by_id = $2 WHERE returned_by_id = $1`,
        `UPDATE material_returns SET confirmed_by_id = $2 WHERE confirmed_by_id = $1`,
        `UPDATE sales_order_components SET completed_by_id = $2 WHERE completed_by_id = $1`,
        `UPDATE additional_material_requests SET requested_by_id = $2 WHERE requested_by_id = $1`,
        `UPDATE additional_material_requests SET approved_by_id = $2 WHERE approved_by_id = $1`,
        `UPDATE vendor_sla_overrides SET authorized_by_id = $2 WHERE authorized_by_id = $1`,
      ];

      for (const sql of reassignQueries) {
        try {
          await this.userRepository.manager.query(sql, [id, targetAdminId]);
        } catch {
          // Continue if table or column does not exist
        }
      }
    }

    // Always clean up auxiliary and file references to prevent FK constraint violations
    const auxiliaryQueries: { sql: string; params: any[] }[] = [
      targetAdminId
        ? { sql: `UPDATE uploaded_files SET created_by_id = $2 WHERE created_by_id = $1`, params: [id, targetAdminId] }
        : null,
      targetAdminId
        ? { sql: `UPDATE uploaded_files SET removed_by_id = $2 WHERE removed_by_id = $1`, params: [id, targetAdminId] }
        : { sql: `UPDATE uploaded_files SET removed_by_id = NULL WHERE removed_by_id = $1`, params: [id] },
      targetAdminId
        ? { sql: `UPDATE attachments SET created_by_id = $2 WHERE created_by_id = $1`, params: [id, targetAdminId] }
        : null,
      { sql: `UPDATE audit_logs SET actor_id = NULL WHERE actor_id = $1`, params: [id] },
      { sql: `UPDATE email_jobs SET recipient_user_id = NULL WHERE recipient_user_id = $1`, params: [id] },
      { sql: `UPDATE email_logs SET recipient_user_id = NULL WHERE recipient_user_id = $1`, params: [id] },
      { sql: `DELETE FROM refresh_tokens WHERE user_id = $1`, params: [id] },
      { sql: `DELETE FROM password_reset_tokens WHERE user_id = $1`, params: [id] },
      { sql: `DELETE FROM notifications WHERE user_id = $1`, params: [id] },
      { sql: `DELETE FROM user_module_permissions WHERE user_id = $1`, params: [id] },
      { sql: `DELETE FROM user_notification_preferences WHERE user_id = $1`, params: [id] },
    ].filter(Boolean) as { sql: string; params: any[] }[];

    for (const item of auxiliaryQueries) {
      try {
        await this.userRepository.manager.query(item.sql, item.params);
      } catch {
        // Continue if table or column doesn't exist
      }
    }

    await this.userRepository.remove(user);
    return {
      success: true,
      message: `User "${user.name}" (${user.email}) deleted successfully.`,
    };
  }
}

