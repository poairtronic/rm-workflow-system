import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Vendor } from '../../vendor/entities/vendor.entity.js';
import { SalesOrderComponent } from '../../sc/entities/sc.entity.js';
import { ProductionProcess } from '../../production-process/entities/production-process.entity.js';
import { User } from '../../users/entities/user.entity.js';
import type { Relation } from 'typeorm';
import { DeliveryChallanItem } from './delivery-challan-item.entity.js';

export enum DeliveryChallanType {
  PRODUCTION_PROCESS_OUTWARD = 'PRODUCTION_PROCESS_OUTWARD',
  GENERAL_INVENTORY_OUTWARD = 'GENERAL_INVENTORY_OUTWARD',
}

export enum DeliveryChallanStatus {
  OPEN = 'OPEN',
  DISPATCHED = 'DISPATCHED',
  PARTIALLY_RETURNED = 'PARTIALLY_RETURNED',
  RETURNED = 'RETURNED',
  CLOSED = 'CLOSED',
}

@Entity('delivery_challans')
@Index('IDX_dc_challan_number', ['challanNumber'], { unique: true })
@Index('IDX_dc_vendor_id', ['vendorId'])
@Index('IDX_dc_sc_id', ['scId'])
@Index('IDX_dc_status', ['status'])
export class DeliveryChallan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'challan_number', type: 'varchar', length: 50, unique: true })
  challanNumber: string;

  @Column({ type: 'varchar', length: 40 })
  type: string;

  @Column({ name: 'vendor_id', type: 'uuid' })
  vendorId: string;

  @ManyToOne(() => Vendor)
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @Column({ name: 'sc_id', type: 'uuid', nullable: true })
  scId?: string | null;

  @ManyToOne(() => SalesOrderComponent)
  @JoinColumn({ name: 'sc_id' })
  sc?: SalesOrderComponent | null;

  @Column({ name: 'process_id', type: 'uuid', nullable: true })
  processId?: string | null;

  @ManyToOne(() => ProductionProcess)
  @JoinColumn({ name: 'process_id' })
  process?: ProductionProcess | null;

  @Column({ name: 'dispatch_date', type: 'timestamptz' })
  dispatchDate: Date;

  @Column({ name: 'expected_return_date', type: 'timestamptz' })
  expectedReturnDate: Date;

  @Column({ type: 'varchar', length: 30, default: DeliveryChallanStatus.OPEN })
  status: string;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
  createdById?: string | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by_id' })
  createdBy?: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => DeliveryChallanItem, (item) => item.challan, { cascade: true })
  items: Relation<DeliveryChallanItem>[];
}
