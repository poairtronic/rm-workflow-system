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
import type { Relation } from 'typeorm';
import { DeliveryChallan } from './delivery-challan.entity.js';
import { Product } from '../../inventory/entities/product.entity.js';
import { Bin } from '../../inventory/entities/bin.entity.js';
import { DcMovement } from './dc-movement.entity.js';

@Entity('delivery_challan_items')
@Index('IDX_dci_challan_id', ['challanId'])
@Index('IDX_dci_product_id', ['productId'])
@Index('IDX_dci_output_product_id', ['outputProductId'])
@Index('IDX_dci_bin_id', ['binId'])
@Index('IDX_dci_output_bin_id', ['outputBinId'])
@Index('IDX_dci_sc_id', ['scId'])
@Index('IDX_dci_process_id', ['processId'])
export class DeliveryChallanItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'sc_id', type: 'uuid', nullable: true })
  scId?: string | null;

  @ManyToOne('SalesOrderComponent', { nullable: true })
  @JoinColumn({ name: 'sc_id', foreignKeyConstraintName: 'FK_dci_sc_id' })
  sc?: any;

  @Column({ name: 'process_id', type: 'uuid', nullable: true })
  processId?: string | null;

  @ManyToOne('ProductionProcess', { nullable: true })
  @JoinColumn({ name: 'process_id', foreignKeyConstraintName: 'FK_dci_process_id' })
  process?: any;

  @Column({ name: 'part_number', type: 'varchar', length: 100, nullable: true })
  partNumber?: string | null;

  @Column({ name: 'part_name', type: 'varchar', length: 255, nullable: true })
  partName?: string | null;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'batch_number', type: 'varchar', length: 100, nullable: true })
  batchNumber?: string | null;

  @Column({ name: 'challan_id', type: 'uuid' })
  challanId: string;

  @ManyToOne(() => DeliveryChallan, (challan) => challan.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'challan_id' })
  challan: Relation<DeliveryChallan>;

  @Column({ name: 'product_id', type: 'uuid', nullable: true })
  productId?: string | null;

  @ManyToOne(() => Product, { nullable: true })
  @JoinColumn({ name: 'product_id' })
  product?: Product;

  @Column({ name: 'bin_id', type: 'uuid', nullable: true })
  binId?: string | null;

  @ManyToOne(() => Bin, { nullable: true })
  @JoinColumn({ name: 'bin_id' })
  bin?: Bin;

  // Type 2 Asymmetric Stock Conversion Fields
  @Column({ name: 'output_product_id', type: 'uuid', nullable: true })
  outputProductId?: string | null;

  @ManyToOne(() => Product, { nullable: true })
  @JoinColumn({ name: 'output_product_id' })
  outputProduct?: Product;

  @Column({ name: 'expected_output_quantity', type: 'numeric', precision: 12, scale: 3, nullable: true })
  expectedOutputQuantity?: number | null;

  @Column({ name: 'output_bin_id', type: 'uuid', nullable: true })
  outputBinId?: string | null;

  @ManyToOne(() => Bin, { nullable: true })
  @JoinColumn({ name: 'output_bin_id' })
  outputBin?: Bin;

  @Column({ name: 'quantity_dispatched', type: 'numeric', precision: 12, scale: 3 })
  quantityDispatched: number;

  @Column({ name: 'quantity_returned', type: 'numeric', precision: 12, scale: 3, default: 0 })
  quantityReturned: number;

  @OneToMany(() => DcMovement, (movement) => movement.challanItem)
  movements?: Relation<DcMovement[]>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
