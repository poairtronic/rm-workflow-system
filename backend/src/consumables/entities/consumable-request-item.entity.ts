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
import { ConsumableRequest } from './consumable-request.entity.js';
import { Product } from '../../inventory/entities/product.entity.js';
import { Vendor } from '../../vendor/entities/vendor.entity.js';
import { Bin } from '../../inventory/entities/bin.entity.js';

export enum ConsumableItemTrack {
  STOCK_ITEM = 'STOCK_ITEM',
  NON_STOCK_OR_NEW = 'NON_STOCK_OR_NEW',
}

export enum ConsumableItemStatus {
  READY_FOR_ISSUE = 'READY_FOR_ISSUE',
  OPEN = 'OPEN',
  PURCHASE_REQUESTED = 'PURCHASE_REQUESTED',
  PURCHASE_RECEIVED = 'PURCHASE_RECEIVED',
  PARTIALLY_ISSUED = 'PARTIALLY_ISSUED',
  ISSUED_TO_PRODUCTION = 'ISSUED_TO_PRODUCTION',
  RECEIVED_BY_PRODUCTION = 'RECEIVED_BY_PRODUCTION',
}

@Entity('consumable_request_items')
export class ConsumableRequestItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'request_id', type: 'uuid' })
  requestId!: string;

  @ManyToOne(() => ConsumableRequest, (request) => request.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'request_id' })
  request!: ConsumableRequest;

  @Index()
  @Column({ name: 'pr_number', type: 'varchar', length: 50, nullable: true })
  prNumber?: string | null;

  @Index()
  @Column({ name: 'product_id', type: 'uuid' })
  productId!: string;

  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  @Column({ name: 'product_code', type: 'varchar', length: 100, nullable: true })
  productCode?: string | null;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'varchar', length: 50, default: 'NOS' })
  uom!: string;

  @Column({ name: 'is_new_product', type: 'boolean', default: false })
  isNewProduct!: boolean;

  @Index()
  @Column({
    name: 'item_category_track',
    type: 'enum',
    enum: ConsumableItemTrack,
    default: ConsumableItemTrack.STOCK_ITEM,
  })
  itemCategoryTrack!: ConsumableItemTrack;

  @Column({
    name: 'stock_available_at_request',
    type: 'numeric',
    precision: 12,
    scale: 3,
    default: 0,
  })
  stockAvailableAtRequest!: number;

  @Column({
    name: 'requested_qty',
    type: 'numeric',
    precision: 12,
    scale: 3,
    default: 0,
  })
  requestedQty!: number;

  @Column({
    name: 'purchase_qty',
    type: 'numeric',
    precision: 12,
    scale: 3,
    nullable: true,
  })
  purchaseQty?: number | null;

  @Column({
    name: 'real_received_qty',
    type: 'numeric',
    precision: 12,
    scale: 3,
    default: 0,
  })
  realReceivedQty!: number;

  @Column({
    name: 'issued_qty',
    type: 'numeric',
    precision: 12,
    scale: 3,
    default: 0,
  })
  issuedQty!: number;

  @Index()
  @Column({ name: 'vendor_id', type: 'uuid', nullable: true })
  vendorId?: string | null;

  @ManyToOne(() => Vendor, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'vendor_id' })
  vendor?: Vendor | null;

  @Column({ name: 'vendor_name', type: 'varchar', length: 255, nullable: true })
  vendorName?: string | null;

  @Column({
    name: 'unit_price',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  unitPrice?: number | null;

  @Column({ name: 'is_new_vendor', type: 'boolean', default: false })
  isNewVendor!: boolean;

  @Column({ name: 'new_vendor_name', type: 'varchar', length: 255, nullable: true })
  newVendorName?: string | null;

  @Column({ name: 'new_vendor_address', type: 'text', nullable: true })
  newVendorAddress?: string | null;

  @Column({ name: 'new_vendor_mobile', type: 'varchar', length: 50, nullable: true })
  newVendorMobile?: string | null;

  @Column({
    name: 'new_vendor_price',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  newVendorPrice?: number | null;

  @Column({ name: 'end_user_in_velan', type: 'varchar', length: 255, nullable: true })
  endUserInVelan?: string | null;

  @Column({ name: 'requested_by', type: 'varchar', length: 150, nullable: true })
  requestedBy?: string | null;

  @Index()
  @Column({ name: 'bin_id', type: 'uuid', nullable: true })
  binId?: string | null;

  @ManyToOne(() => Bin, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'bin_id' })
  bin?: Bin | null;

  @Index()
  @Column({
    type: 'enum',
    enum: ConsumableItemStatus,
    default: ConsumableItemStatus.OPEN,
  })
  status!: ConsumableItemStatus;

  @Column({
    name: 'printed_at',
    type: 'timestamp with time zone',
    nullable: true,
  })
  printedAt?: Date | null;

  @Column({
    name: 'purchase_received_at',
    type: 'timestamp with time zone',
    nullable: true,
  })
  purchaseReceivedAt?: Date | null;

  @Column({
    name: 'issued_at',
    type: 'timestamp with time zone',
    nullable: true,
  })
  issuedAt?: Date | null;

  @Column({
    name: 'production_received_at',
    type: 'timestamp with time zone',
    nullable: true,
  })
  productionReceivedAt?: Date | null;

  @Column({
    name: 'production_received_by_id',
    type: 'uuid',
    nullable: true,
  })
  productionReceivedById?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt!: Date;
}
