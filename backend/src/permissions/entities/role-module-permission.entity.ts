import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Role } from '../../roles/entities/role.entity.js';
import { SystemModule } from './system-module.entity.js';

@Entity('role_module_permissions')
@Unique(['roleId', 'moduleKey'])
export class RoleModulePermission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'role_id' })
  roleId!: string;

  @ManyToOne(() => Role, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role!: Role;

  @Column({ name: 'module_key', length: 50 })
  moduleKey!: string;

  @ManyToOne(() => SystemModule, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'module_key' })
  module!: SystemModule;

  @Column({ name: 'is_allowed', default: true })
  isAllowed!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
