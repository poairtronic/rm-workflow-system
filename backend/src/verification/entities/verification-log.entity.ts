import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { RmRequest } from '../../rm/entities/rm-request.entity.js';
import { User } from '../../users/entities/user.entity.js';

export enum VerificationAction {
  APPROVE = 'APPROVE',
  EDIT_AND_APPROVE = 'EDIT_AND_APPROVE',
  REJECT = 'REJECT',
}

@Entity('senior_verification_logs')
export class SeniorVerificationLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'rm_request_id' })
  rmRequestId!: string;

  @ManyToOne(() => RmRequest, (req) => req.verificationLogs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'rm_request_id' })
  rmRequest!: RmRequest;

  @Column({ name: 'verified_by_id' })
  verifiedById!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'verified_by_id' })
  verifiedBy!: User;

  @Column({
    type: 'varchar',
    length: 50,
  })
  action!: VerificationAction;

  @Column({ name: 'revision_reason', type: 'text', nullable: true })
  revisionReason?: string;

  @Column({ name: 'rejection_notes', type: 'text', nullable: true })
  rejectionNotes?: string;

  @Column({ name: 'changes_json', type: 'jsonb', nullable: true })
  changesJson?: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
