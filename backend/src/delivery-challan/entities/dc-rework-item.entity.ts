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
import type { Relation } from 'typeorm';
import { DeliveryChallan } from './delivery-challan.entity.js';
import { SalesOrderComponent } from '../../sc/entities/sc.entity.js';
import { PurchaseOrder } from '../../po/entities/po.entity.js';
import { Product } from '../../inventory/entities/product.entity.js';
import { Vendor } from '../../vendor/entities/vendor.entity.js';

export enum ReworkItemStatus {
  PENDING_ACK = 'PENDING_ACK',
  MARKED_OKAY = 'MARKED_OKAY',
  RE_DISPATCHED = 'RE_DISPATCHED',
}

@Entity('dc_rework_items')
@Index('IDX_dc_rework_items_source_dc', ['sourceDcId'])
@Index('IDX_dc_rework_items_sc_id', ['scId'])
@Index('IDX_dc_rework_items_status', ['reworkStatus'])
@Index('IDX_dc_rework_items_vendor', ['originalVendorId'])
export class DcReworkItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'source_dc_id', type: 'uuid' })
  sourceDcId: string;

  @ManyToOne(() => DeliveryChallan, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'source_dc_id' })
  sourceDc: Relation<DeliveryChallan>;

  @Column({ name: 'source_dc_number', type: 'varchar', length: 50 })
  sourceDcNumber: string;

  @Column({ name: 'dc_type', type: 'varchar', length: 40 })
  dcType: string;

  @Column({ name: 'sc_id', type: 'uuid', nullable: true })
  scId?: string | null;

  @ManyToOne(() => SalesOrderComponent, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sc_id' })
  sc?: Relation<SalesOrderComponent> | null;

  @Column({ name: 'sc_number', type: 'varchar', length: 50, nullable: true })
  scNumber?: string | null;

  @Column({ name: 'po_id', type: 'uuid', nullable: true })
  poId?: string | null;

  @ManyToOne(() => PurchaseOrder, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'po_id' })
  po?: Relation<PurchaseOrder> | null;

  @Column({ name: 'po_number', type: 'varchar', length: 50, nullable: true })
  poNumber?: string | null;

  @Column({ name: 'product_id', type: 'uuid', nullable: true })
  productId?: string | null;

  @ManyToOne(() => Product, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'product_id' })
  product?: Relation<Product> | null;

  @Column({ name: 'product_name', type: 'varchar', length: 255 })
  productName: string;

  @Column({ name: 'part_number', type: 'varchar', length: 100, nullable: true })
  partNumber?: string | null;

  @Column({ type: 'varchar', length: 20, default: 'PCS' })
  uom: string;

  @Column({ name: 'original_vendor_id', type: 'uuid' })
  originalVendorId: string;

  @ManyToOne(() => Vendor, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'original_vendor_id' })
  originalVendor: Relation<Vendor>;

  @Column({ name: 'original_vendor_name', type: 'varchar', length: 255 })
  originalVendorName: string;

  @Column({ name: 'rejected_qty', type: 'numeric', precision: 12, scale: 3 })
  rejectedQty: number;

  @Column({ name: 'qc_remarks', type: 'text', nullable: true })
  qcRemarks?: string | null;

  @Column({
    name: 'rework_status',
    type: 'varchar',
    length: 30,
    default: ReworkItemStatus.PENDING_ACK,
  })
  reworkStatus: ReworkItemStatus;

  @Column({ name: 'rework_dc_id', type: 'uuid', nullable: true })
  reworkDcId?: string | null;

  @ManyToOne(() => DeliveryChallan, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'rework_dc_id' })
  reworkDc?: Relation<DeliveryChallan> | null;

  @Column({ name: 'rework_dc_number', type: 'varchar', length: 50, nullable: true })
  reworkDcNumber?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
