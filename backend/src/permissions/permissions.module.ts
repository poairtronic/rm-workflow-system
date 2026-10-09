import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PermissionsController } from './permissions.controller.js';
import { PermissionsService } from './permissions.service.js';
import { SystemModule } from './entities/system-module.entity.js';
import { RoleModulePermission } from './entities/role-module-permission.entity.js';
import { UserModulePermission } from './entities/user-module-permission.entity.js';
import { Role } from '../roles/entities/role.entity.js';
import { User } from '../users/entities/user.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SystemModule,
      RoleModulePermission,
      UserModulePermission,
      Role,
      User,
    ]),
  ],
  controllers: [PermissionsController],
  providers: [PermissionsService],
  exports: [PermissionsService],
})
export class PermissionsModule {}
