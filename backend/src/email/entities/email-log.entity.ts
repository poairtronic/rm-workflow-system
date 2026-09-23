import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { EmailJob } from './email-job.entity.js';
import { User } from '../../users/entities/user.entity.js';
import { EmailJobStatus } from '../enums/email-job-status.enum.js';
import { EmailProvider } from '../enums/email-provider.enum.js';

@Entity('email_logs')
@Index('IDX_email_logs_job_id', ['jobId'])
@Index('IDX_email_logs_created_at', ['createdAt'])
@Index('IDX_email_logs_provider_message_id', ['providerMessageId'])
@Index('IDX_email_logs_status', ['status'])
export class EmailLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'job_id', type: 'uuid' })
  jobId!: string;

  @ManyToOne(() => EmailJob, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'job_id' })
  job?: EmailJob;

  @Column({ name: 'event_type', type: 'varchar', length: 100 })
  eventType!: string;

  @Column({ name: 'recipient_email', type: 'varchar', length: 255 })
  recipientEmail!: string;

  @Column({ name: 'recipient_user_id', type: 'uuid', nullable: true })
  recipientUserId?: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'recipient_user_id' })
  user?: User | null;

  @Column({ name: 'recipient_name', type: 'varchar', length: 150, nullable: true })
  recipientName?: string | null;

  @Column({ type: 'varchar', length: 255 })
  subject!: string;

  @Column({ type: 'varchar', length: 50, default: EmailProvider.GMAIL_API })
  provider!: EmailProvider;

  @Column({ type: 'integer' })
  attempt!: number;

  @Column({ type: 'varchar', length: 50 })
  status!: EmailJobStatus;

  @Column({ name: 'provider_message_id', type: 'varchar', length: 255, nullable: true })
  providerMessageId?: string | null;

  @Column({ name: 'error_code', type: 'varchar', length: 100, nullable: true })
  errorCode?: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string | null;

  @CreateDateColumn({ name: 'attempted_at', type: 'timestamptz' })
  attemptedAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
