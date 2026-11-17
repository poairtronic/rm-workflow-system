import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import type { RoleEmailSetting } from './role-email-setting.entity.js';
import type { UserEmailOverride } from './user-email-override.entity.js';

@Entity('notification_events')
export class NotificationEvent {
  @PrimaryColumn({ type: 'varchar', length: 100 })
  code!: string;

  @Column({ type: 'varchar', length: 150 })
  label!: string;

  @Column({ type: 'varchar', length: 50 })
  category!: string;

  @Column({ name: 'is_configurable', type: 'boolean', default: true })
  isConfigurable!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @OneToMany('RoleEmailSetting', (setting: RoleEmailSetting) => setting.notificationEvent)
  roleSettings?: RoleEmailSetting[];

  @OneToMany('UserEmailOverride', (override: UserEmailOverride) => override.notificationEvent)
  userOverrides?: UserEmailOverride[];
}
