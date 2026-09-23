import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';
import { EmailJobStatus } from '../enums/email-job-status.enum.js';
import { EmailProvider } from '../enums/email-provider.enum.js';

@Entity('email_jobs')
@Index('IDX_email_jobs_status_next_retry', ['status', 'nextRetryAt'])
@Index('IDX_email_jobs_queue_claim', ['status', 'nextRetryAt', 'priority', 'createdAt'])
export class EmailJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('IDX_email_jobs_recipient_user_id')
  @Column({ name: 'recipient_user_id', type: 'uuid', nullable: true })
  recipientUserId?: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'recipient_user_id' })
  user?: User | null;

  @Column({ name: 'recipient_email', type: 'varchar', length: 255 })
  recipientEmail!: string;

  @Column({ name: 'recipient_name', type: 'varchar', length: 150, nullable: true })
  recipientName?: string | null;

  @Column({ name: 'event_type', type: 'varchar', length: 100 })
  eventType!: string;

  @Column({ name: 'template_key', type: 'varchar', length: 100 })
  templateKey!: string;

  @Column({ type: 'varchar', length: 255 })
  subject!: string;

  @Column({ name: 'body_text', type: 'text' })
  bodyText!: string;

  @Column({ name: 'body_html', type: 'text' })
  bodyHtml!: string;

  @Column({ type: 'varchar', length: 50, default: EmailJobStatus.PENDING })
  status!: EmailJobStatus;

  @Column({ type: 'integer', default: 100 })
  priority!: number;

  @Column({ type: 'integer', default: 0 })
  attempts!: number;

  @Column({ name: 'max_attempts', type: 'integer', default: 3 })
  maxAttempts!: number;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError?: string | null;

  @Column({ name: 'next_retry_at', type: 'timestamptz', nullable: true })
  nextRetryAt?: Date | null;

  @Column({ name: 'locked_at', type: 'timestamptz', nullable: true })
  lockedAt?: Date | null;

  @Column({ name: 'locked_by', type: 'varchar', length: 100, nullable: true })
  lockedBy?: string | null;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt?: Date | null;

  @Column({ type: 'varchar', length: 50, default: EmailProvider.GMAIL_API })
  provider!: EmailProvider;

  @Column({ name: 'provider_message_id', type: 'varchar', length: 255, nullable: true })
  providerMessageId?: string | null;

  @Index('UQ_email_jobs_idempotency_key', { unique: true })
  @Column({ name: 'idempotency_key', type: 'varchar', length: 255, unique: true })
  idempotencyKey!: string;

  @Column({ type: 'jsonb', nullable: true })
  payload?: Record<string, any> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
