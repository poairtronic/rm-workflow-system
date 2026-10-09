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
import { User } from '../../users/entities/user.entity.js';
import { SystemModule } from './system-module.entity.js';

export type AccessOverrideType = 'GRANT' | 'REVOKE';

@Entity('user_module_permissions')
@Unique(['userId', 'moduleKey'])
export class UserModulePermission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'module_key', length: 50 })
  moduleKey!: string;

  @ManyToOne(() => SystemModule, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'module_key' })
  module!: SystemModule;

  @Column({ name: 'access_type', length: 10 })
  accessType!: AccessOverrideType;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
