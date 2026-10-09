import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemModule } from './entities/system-module.entity.js';
import { RoleModulePermission } from './entities/role-module-permission.entity.js';
import { UserModulePermission } from './entities/user-module-permission.entity.js';
import { Role } from '../roles/entities/role.entity.js';
import { User } from '../users/entities/user.entity.js';
import { UserOverrideItemDto } from './dto/update-user-permissions.dto.js';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(SystemModule)
    private readonly moduleRepo: Repository<SystemModule>,
    @InjectRepository(RoleModulePermission)
    private readonly rolePermRepo: Repository<RoleModulePermission>,
    @InjectRepository(UserModulePermission)
    private readonly userPermRepo: Repository<UserModulePermission>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async getAllModules(): Promise<SystemModule[]> {
    return this.moduleRepo.find({
      where: { isActive: true },
      order: { groupName: 'ASC', sortOrder: 'ASC' },
    });
  }

  async getRoleMatrix() {
    const [roles, modules, rolePerms] = await Promise.all([
      this.roleRepo.find({ order: { name: 'ASC' } }),
      this.moduleRepo.find({ where: { isActive: true }, order: { groupName: 'ASC', sortOrder: 'ASC' } }),
      this.rolePermRepo.find({ where: { isAllowed: true } }),
    ]);

    const matrix: Record<string, string[]> = {};
    for (const r of roles) {
      matrix[r.id] = [];
    }

    for (const perm of rolePerms) {
      if (matrix[perm.roleId]) {
        matrix[perm.roleId].push(perm.moduleKey);
      }
    }

    return {
      roles,
      modules,
      matrix,
    };
  }

  async updateRolePermissions(roleId: string, allowedModuleKeys: string[]) {
    const role = await this.roleRepo.findOne({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException(`Role with ID ${roleId} not found`);
    }

    // Safety guard: ADMIN must always have users_master access
    if (role.name === 'ADMIN' && !allowedModuleKeys.includes('users_master')) {
      allowedModuleKeys.push('users_master');
    }

    await this.rolePermRepo.delete({ roleId });

    if (allowedModuleKeys.length > 0) {
      const entities = allowedModuleKeys.map((moduleKey) =>
        this.rolePermRepo.create({
          roleId,
          moduleKey,
          isAllowed: true,
        }),
      );
      await this.rolePermRepo.save(entities);
    }

    return {
      success: true,
      roleId,
      roleName: role.name,
      allowedModuleKeys,
    };
  }

  async getUserPermissions(userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: { role: true },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const allModules = await this.moduleRepo.find({
      where: { isActive: true },
      order: { groupName: 'ASC', sortOrder: 'ASC' },
    });

    // If user is ADMIN, effective is all modules
    if (user.role?.name === 'ADMIN') {
      const allKeys = allModules.map((m) => m.moduleKey);
      return {
        userId: user.id,
        userName: user.name,
        roleName: user.role.name,
        effectiveModules: allKeys,
        roleModules: allKeys,
        overrides: [],
      };
    }

    // Role default permissions
    let roleModules: string[] = [];
    if (user.roleId) {
      const rolePerms = await this.rolePermRepo.find({
        where: { roleId: user.roleId, isAllowed: true },
      });
      roleModules = rolePerms.map((p) => p.moduleKey);
    }

    // User specific overrides
    const userOverrides = await this.userPermRepo.find({
      where: { userId },
    });

    const effectiveSet = new Set<string>(roleModules);

    for (const ov of userOverrides) {
      if (ov.accessType === 'GRANT') {
        effectiveSet.add(ov.moduleKey);
      } else if (ov.accessType === 'REVOKE') {
        effectiveSet.delete(ov.moduleKey);
      }
    }

    return {
      userId: user.id,
      userName: user.name,
      roleName: user.role?.name || 'UNKNOWN',
      effectiveModules: Array.from(effectiveSet),
      roleModules,
      overrides: userOverrides.map((o) => ({
        moduleKey: o.moduleKey,
        accessType: o.accessType,
      })),
    };
  }

  async updateUserOverrides(userId: string, overrides: UserOverrideItemDto[]) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: { role: true },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    for (const item of overrides) {
      if (item.action === 'INHERIT') {
        await this.userPermRepo.delete({
          userId,
          moduleKey: item.moduleKey,
        });
      } else {
        const existing = await this.userPermRepo.findOne({
          where: { userId, moduleKey: item.moduleKey },
        });

        if (existing) {
          existing.accessType = item.action;
          await this.userPermRepo.save(existing);
        } else {
          const newOverride = this.userPermRepo.create({
            userId,
            moduleKey: item.moduleKey,
            accessType: item.action,
          });
          await this.userPermRepo.save(newOverride);
        }
      }
    }

    return this.getUserPermissions(userId);
  }
}
