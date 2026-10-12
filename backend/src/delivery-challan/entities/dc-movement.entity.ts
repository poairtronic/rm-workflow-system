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
import { DeliveryChallanItem } from './delivery-challan-item.entity.js';
import { Product } from '../../inventory/entities/product.entity.js';
import { SalesOrderComponent } from '../../sc/entities/sc.entity.js';
import { ProductionProcess } from '../../production-process/entities/production-process.entity.js';

export enum DcMovementStatus {
  DISPATCHED = 'DISPATCHED',
  PARTIALLY_RETURNED = 'PARTIALLY_RETURNED',
  RETURNED = 'RETURNED',
}

@Entity('dc_movements')
@Index('IDX_dc_movements_sc_product', ['scId', 'dispatchedProductId'])
@Index('IDX_dc_movements_challan_id', ['challanId'])
@Index('IDX_dc_movements_challan_item_id', ['challanItemId'])
@Index('IDX_dc_movements_status', ['status'])
export class DcMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'challan_id', type: 'uuid' })
  challanId: string;

  @ManyToOne(() => DeliveryChallan, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'challan_id' })
  challan: Relation<DeliveryChallan>;

  @Column({ name: 'challan_item_id', type: 'uuid' })
  challanItemId: string;

  @ManyToOne(() => DeliveryChallanItem, (item) => item.movements, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'challan_item_id' })
  challanItem: Relation<DeliveryChallanItem>;

  @Column({ name: 'sc_id', type: 'uuid' })
  scId: string;

  @ManyToOne(() => SalesOrderComponent)
  @JoinColumn({ name: 'sc_id' })
  sc: Relation<SalesOrderComponent>;

  @Column({ name: 'process_id', type: 'uuid', nullable: true })
  processId?: string | null;

  @ManyToOne(() => ProductionProcess, { nullable: true })
  @JoinColumn({ name: 'process_id' })
  process?: Relation<ProductionProcess>;

  @Column({ name: 'dispatched_product_id', type: 'uuid' })
  dispatchedProductId: string;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'dispatched_product_id' })
  dispatchedProduct: Relation<Product>;

  @Column({ name: 'dispatched_qty', type: 'numeric', precision: 12, scale: 3 })
  dispatchedQty: number;

  @Column({ name: 'returned_product_id', type: 'uuid', nullable: true })
  returnedProductId?: string | null;

  @ManyToOne(() => Product, { nullable: true })
  @JoinColumn({ name: 'returned_product_id' })
  returnedProduct?: Relation<Product>;

  @Column({ name: 'returned_qty', type: 'numeric', precision: 12, scale: 3, default: 0 })
  returnedQty: number;

  @Column({
    type: 'varchar',
    length: 50,
    default: DcMovementStatus.DISPATCHED,
  })
  status: DcMovementStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

