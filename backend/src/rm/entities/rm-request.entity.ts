import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { SalesOrderComponent } from '../../sc/entities/sc.entity.js';
import { User } from '../../users/entities/user.entity.js';
import { RmItem } from './rm-item.entity.js';
import { SeniorVerificationLog } from '../../verification/entities/verification-log.entity.js';

export enum RmRequestStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  SENIOR_VERIFIED = 'SENIOR_VERIFIED',
  REJECTED = 'REJECTED',
}

@Entity('rm_requests')
export class RmRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ name: 'sc_id', unique: true })
  scId!: string;

  @OneToOne(() => SalesOrderComponent, (sc) => sc.rmRequest, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sc_id' })
  salesOrderComponent!: SalesOrderComponent;

  @Column({ name: 'created_by_id' })
  createdById!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy!: User;

  @Index()
  @Column({
    type: 'varchar',
    length: 50,
    default: RmRequestStatus.DRAFT,
  })
  status!: RmRequestStatus;

  @Column({ name: 'revision_number', type: 'int', default: 1 })
  revisionNumber!: number;

  @Column({
    name: 'submitted_at',
    type: 'timestamp with time zone',
    nullable: true,
  })
  submittedAt?: Date;

  @Column({
    name: 'verified_at',
    type: 'timestamp with time zone',
    nullable: true,
  })
  verifiedAt?: Date;

  @Column({ name: 'verified_by_id', nullable: true })
  verifiedById?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'verified_by_id' })
  verifiedBy?: User;

  @OneToMany(() => RmItem, (item) => item.rmRequest, { cascade: true })
  items!: RmItem[];

  @OneToMany(() => SeniorVerificationLog, (log) => log.rmRequest)
  verificationLogs!: SeniorVerificationLog[];

  @Column({ type: 'text', nullable: true })
  remarks?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
