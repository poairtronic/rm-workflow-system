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
import { User } from '../../users/entities/user.entity.js';
import { NotificationEvent } from './notification-event.entity.js';

export type OverrideState = 'ON' | 'OFF';

@Entity('user_email_overrides')
@Unique(['userId', 'eventCode'])
export class UserEmailOverride {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('IDX_user_email_overrides_user_id')
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Index('IDX_user_email_overrides_event_code')
  @Column({ name: 'event_code', type: 'varchar', length: 100 })
  eventCode!: string;

  @ManyToOne(() => NotificationEvent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_code' })
  notificationEvent!: NotificationEvent;

  @Column({ type: 'varchar', length: 10 })
  state!: OverrideState;

  @Column({ name: 'updated_by', type: 'varchar', length: 100, nullable: true })
  updatedBy?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
