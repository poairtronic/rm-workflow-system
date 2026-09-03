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
import { RmRequest } from '../../rm/entities/rm-request.entity.js';
import { User } from '../../users/entities/user.entity.js';

export enum VerificationStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REVISED = 'REVISED',
  REJECTED = 'REJECTED',
}

@Entity('rm_verifications')
export class RmVerification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'rm_form_id' })
  rmFormId!: string;

  @ManyToOne(() => RmRequest, (req) => req.verificationLogs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'rm_form_id' })
  rmForm!: RmRequest;

  @Column({ name: 'verified_by_id' })
  verifiedById!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'verified_by_id' })
  verifiedBy!: User;

  @Column({
    type: 'varchar',
    length: 50,
    default: VerificationStatus.PENDING,
  })
  status!: VerificationStatus;

  @Column({ type: 'text', nullable: true })
  remarks?: string;

  @Column({
    name: 'verified_at',
    type: 'timestamp with time zone',
    nullable: true,
  })
  verifiedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
