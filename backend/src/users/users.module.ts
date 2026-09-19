import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { User } from './entities/user.entity.js';
import { Role } from '../roles/entities/role.entity.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([User, Role]), AuthModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
