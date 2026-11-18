import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity('alert_notification_state')
@Unique('UQ_alert_notification_state', ['eventCode', 'entityType', 'entityId', 'recipientUserId'])
@Index('IDX_alert_state_lookup', ['eventCode', 'recipientUserId', 'entityId'])
@Index('IDX_alert_state_last_alerted', ['lastAlertedAt'])
export class AlertNotificationState {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'event_code', type: 'varchar', length: 64 })
  eventCode!: string;

  @Column({ name: 'entity_type', type: 'varchar', length: 64 })
  entityType!: string;

  @Column({ name: 'entity_id', type: 'varchar', length: 128 })
  entityId!: string;

  @Column({ name: 'recipient_user_id', type: 'uuid' })
  recipientUserId!: string;

  @Column({ name: 'last_alerted_at', type: 'timestamptz' })
  lastAlertedAt!: Date;

  @Column({ name: 'alert_count', type: 'integer', default: 1 })
  alertCount!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
