import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { DeliveryChallan } from './delivery-challan.entity.js';
import { DeliveryChallanItem } from './delivery-challan-item.entity.js';
import { User } from '../../users/entities/user.entity.js';

@Entity('dc_qc_inspections')
@Index('IDX_dc_qc_inspections_challan_id', ['challanId'])
@Index('IDX_dc_qc_inspections_item_id', ['challanItemId'])
export class DcQcInspection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'challan_id', type: 'uuid' })
  challanId: string;

  @ManyToOne(() => DeliveryChallan, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'challan_id' })
  challan: Relation<DeliveryChallan>;

  @Column({ name: 'challan_item_id', type: 'uuid' })
  challanItemId: string;

  @ManyToOne(() => DeliveryChallanItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'challan_item_id' })
  challanItem: Relation<DeliveryChallanItem>;

  @Column({ name: 'batch_received_qty', type: 'numeric', precision: 12, scale: 3 })
  batchReceivedQty: number;

  @Column({ name: 'passed_qty', type: 'numeric', precision: 12, scale: 3, default: 0 })
  passedQty: number;

  @Column({ name: 'rejected_qty', type: 'numeric', precision: 12, scale: 3, default: 0 })
  rejectedQty: number;

  @Column({ name: 'actual_inward_qty', type: 'numeric', precision: 12, scale: 3, nullable: true })
  actualInwardQty?: number | null;

  @Column({ type: 'text', nullable: true })
  remarks?: string | null;

  @Column({ name: 'inspected_by_id', type: 'uuid', nullable: true })
  inspectedById?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'inspected_by_id' })
  inspectedBy?: Relation<User> | null;

  @Column({ name: 'inspected_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  inspectedAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
