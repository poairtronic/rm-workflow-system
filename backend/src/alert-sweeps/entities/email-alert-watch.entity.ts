import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity('email_alert_watch')
@Unique('UQ_email_alert_watch_alert_entity', ['alertCode', 'entityId'])
export class EmailAlertWatch {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('IDX_email_alert_watch_alert_code')
  @Column({ name: 'alert_code', type: 'varchar', length: 100 })
  alertCode!: string;

  @Column({ name: 'entity_type', type: 'varchar', length: 50 })
  entityType!: string;

  @Index('IDX_email_alert_watch_entity_id')
  @Column({ name: 'entity_id', type: 'varchar', length: 100 })
  entityId!: string;

  @Index('IDX_email_alert_watch_first_seen_at')
  @CreateDateColumn({
    name: 'first_seen_at',
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
  })
  firstSeenAt!: Date;
}
