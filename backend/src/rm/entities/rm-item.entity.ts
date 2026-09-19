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
import type { RmRequest } from './rm-request.entity.js';
import type { SalesOrderComponent } from '../../sc/entities/sc.entity.js';
import type { MaterialIssueItem } from '../../material-issue/entities/material-issue-item.entity.js';
import type { MaterialConsumption } from '../../production/entities/material-consumption.entity.js';
import type { MaterialReturnItem } from '../../production/entities/material-return-item.entity.js';
import type { Product } from '../../inventory/entities/product.entity.js';

export enum AvailabilityStatus {
  AVAILABLE = 'AVAILABLE',
  PARTIAL = 'PARTIAL',
  NOT_AVAILABLE = 'NOT_AVAILABLE',
}

@Entity('rm_items')
export class RmItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'rm_form_id' })
  rmFormId!: string;

  @ManyToOne('RmRequest', (req: RmRequest) => req.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rm_form_id' })
  rmRequest!: RmRequest;

  @Index()
  @Column({ name: 'sc_id', nullable: true })
  scId?: string;

  @ManyToOne('SalesOrderComponent', (sc: SalesOrderComponent) => sc.rmItems, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sc_id' })
  salesOrderComponent?: SalesOrderComponent;

  /* Required Fields */
  @Index()
  @Column({ length: 100 })
  material!: string;

  @Column({ name: 'material_type', length: 50, default: 'ROUND_BAR' })
  materialType!: string;

  @Column({ length: 100 })
  grade!: string;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 3,
  })
  quantity!: number;

  @Column({ length: 100 })
  size!: string;

  /* Optional Flexible Dimensional Fields */
  @Column({
    name: 'length',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  length?: number;

  @Column({
    name: 'width',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  width?: number;

  @Column({
    name: 'thickness',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  thickness?: number;

  @Column({
    name: 'diameter',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  diameter?: number;

  @Column({
    name: 'weight',
    type: 'numeric',
    precision: 12,
    scale: 3,
    nullable: true,
  })
  weight?: number;

  @Column({ name: 'weight_unit', length: 20, default: 'KG' })
  weightUnit!: string;

  @Column({ type: 'text', nullable: true })
  remarks?: string;

    @Column({ name: 'mapped_product_id', nullable: true })
  mappedProductId?: string;

  @ManyToOne('Product', { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'mapped_product_id' })
  mappedProduct?: Product;

  @Column({
    name: 'availability_status',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  availabilityStatus?: AvailabilityStatus;

  @Column({
    name: 'available_quantity_snapshot',
    type: 'numeric',
    precision: 12,
    scale: 3,
    nullable: true,
  })
  availableQuantitySnapshot?: number;

  @OneToMany('MaterialIssueItem', (item: MaterialIssueItem) => item.rmItem)
  materialIssues!: MaterialIssueItem[];

  @OneToMany('MaterialConsumption', (cons: MaterialConsumption) => cons.rmItem)
  materialConsumptions!: MaterialConsumption[];

  @OneToMany('MaterialReturnItem', (ret: MaterialReturnItem) => ret.rmItem)
  materialReturns!: MaterialReturnItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

