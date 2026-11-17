import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { Role } from '../../roles/entities/role.entity.js';
import { NotificationEvent } from './notification-event.entity.js';

@Entity('role_email_settings')
@Unique(['roleId', 'eventCode'])
export class RoleEmailSetting {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('IDX_role_email_settings_role_id')
  @Column({ name: 'role_id', type: 'uuid' })
  roleId!: string;

  @ManyToOne(() => Role, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role!: Role;

  @Index('IDX_role_email_settings_event_code')
  @Column({ name: 'event_code', type: 'varchar', length: 100 })
  eventCode!: string;

  @ManyToOne(() => NotificationEvent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_code' })
  notificationEvent!: NotificationEvent;

  @Column({ type: 'boolean', default: false })
  enabled!: boolean;

  @Column({ name: 'updated_by', type: 'varchar', length: 100, nullable: true })
  updatedBy?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
