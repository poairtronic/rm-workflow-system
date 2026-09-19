import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import type { SalesOrderComponent } from '../../sc/entities/sc.entity.js';
import { User } from '../../users/entities/user.entity.js';
import type { AdditionalMaterialRequestItem } from './additional-request-item.entity.js';

export enum AdditionalReason {
  ADDITIONAL_REQUIREMENT = 'ADDITIONAL_REQUIREMENT',
  DAMAGE = 'DAMAGE',
  WASTAGE = 'WASTAGE',
  MANUFACTURING_ERROR = 'MANUFACTURING_ERROR',
  OTHER = 'OTHER',
}

export enum AdditionalRequestStatus {
  REQUESTED = 'REQUESTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  ISSUED = 'ISSUED',
  CANCELLED = 'CANCELLED',
}

@Entity('additional_material_requests')
export class AdditionalMaterialRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'sc_id' })
  scId!: string;

  @ManyToOne(
    'SalesOrderComponent',
    (sc: SalesOrderComponent) => sc.additionalRequests,
    {
      onDelete: 'RESTRICT',
    },
  )
  @JoinColumn({ name: 'sc_id' })
  salesOrderComponent!: SalesOrderComponent;

  @Column({ name: 'requested_by_id' })
  requestedById!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'requested_by_id' })
  requestedBy!: User;

  @Column({
    type: 'varchar',
    length: 50,
    default: AdditionalRequestStatus.REQUESTED,
  })
  status!: AdditionalRequestStatus;

  @Column({
    type: 'varchar',
    length: 50,
    default: AdditionalReason.ADDITIONAL_REQUIREMENT,
  })
  reason!: AdditionalReason;

  @Column({ type: 'text', nullable: true })
  remarks?: string;

  @Column({
    name: 'requested_at',
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
  })
  requestedAt!: Date;

  @Column({
    name: 'approved_at',
    type: 'timestamp with time zone',
    nullable: true,
  })
  approvedAt?: Date;

  @Column({ name: 'approved_by_id', nullable: true })
  approvedById?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'approved_by_id' })
  approvedBy?: User;

  @OneToMany(
    'AdditionalMaterialRequestItem',
    (item: AdditionalMaterialRequestItem) => item.request,
    {
      cascade: true,
    },
  )
  items!: AdditionalMaterialRequestItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
