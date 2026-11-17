import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type EmailSkipReason =
  | 'OVERRIDE_OFF'
  | 'LEGACY_USER_OFF'
  | 'ACTOR'
  | 'GLOBAL_OFF'
  | 'CONSUMABLE_GATE_OFF';

@Entity('email_skip_log')
export class EmailSkipLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_email_skip_log_event_code')
  @Column({ name: 'event_code', type: 'varchar', length: 100 })
  eventCode: string;

  @Index('IDX_email_skip_log_recipient_user_id')
  @Column({ name: 'recipient_user_id', type: 'uuid', nullable: true })
  recipientUserId?: string | null;

  @Column({ name: 'recipient_name', type: 'varchar', length: 150, nullable: true })
  recipientName?: string | null;

  @Column({ name: 'recipient_email', type: 'varchar', length: 255, nullable: true })
  recipientEmail?: string | null;

  @Column({ name: 'reason', type: 'varchar', length: 40 })
  reason: EmailSkipReason | string;

  @Column({ name: 'entity_id', type: 'varchar', length: 255, nullable: true })
  entityId?: string | null;

  @Column({ name: 'mode', type: 'varchar', length: 10 })
  mode: string;

  @Column({ name: 'dedupe_key', type: 'varchar', length: 400, unique: true })
  dedupeKey: string;

  @Index('IDX_email_skip_log_created_at')
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
