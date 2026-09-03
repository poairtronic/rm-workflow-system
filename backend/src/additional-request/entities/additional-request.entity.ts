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
import { SalesOrderComponent } from '../../sc/entities/sc.entity.js';
import { RmItem } from '../../rm/entities/rm-item.entity.js';
import { User } from '../../users/entities/user.entity.js';

export enum AdditionalReasonCode {
  TOOL_BREAKAGE = 'TOOL_BREAKAGE',
  DEFECTIVE_RAW_MATERIAL = 'DEFECTIVE_RAW_MATERIAL',
  OPERATOR_ERROR = 'OPERATOR_ERROR',
  DESIGN_REVISION = 'DESIGN_REVISION',
  MACHINE_BREAKDOWN = 'MACHINE_BREAKDOWN',
  OTHER = 'OTHER',
}

export enum AdditionalRequestStatus {
  REQUESTED = 'REQUESTED',
  APPROVED = 'APPROVED',
  ISSUED = 'ISSUED',
  REJECTED = 'REJECTED',
}

@Entity('additional_material_requests')
export class AdditionalMaterialRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'sc_id' })
  scId!: string;

  @ManyToOne(() => SalesOrderComponent, (sc) => sc.additionalRequests, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'sc_id' })
  salesOrderComponent!: SalesOrderComponent;

  @Index()
  @Column({ name: 'rm_item_id' })
  rmItemId!: string;

  @ManyToOne(() => RmItem, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'rm_item_id' })
  rmItem!: RmItem;

  @Column({
    name: 'requested_quantity',
    type: 'numeric',
    precision: 12,
    scale: 3,
  })
  requestedQuantity!: number;

  @Column({ length: 20, default: 'NOS' })
  unit!: string;

  @Column({
    name: 'reason_code',
    type: 'varchar',
    length: 50,
    default: AdditionalReasonCode.TOOL_BREAKAGE,
  })
  reasonCode!: AdditionalReasonCode;

  @Column({ name: 'reason_description', type: 'text' })
  reasonDescription!: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: AdditionalRequestStatus.REQUESTED,
  })
  status!: AdditionalRequestStatus;

  @Column({ name: 'requested_by_id' })
  requestedById!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'requested_by_id' })
  requestedBy!: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
