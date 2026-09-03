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
import { PurchaseOrder } from '../../po/entities/po.entity.js';
import { RmRequest } from '../../rm/entities/rm-request.entity.js';
import { RmItem } from '../../rm/entities/rm-item.entity.js';
import { MaterialIssue } from '../../material-issue/entities/material-issue.entity.js';
import { MaterialConsumption } from '../../production/entities/material-consumption.entity.js';
import { MaterialReturn } from '../../production/entities/material-return.entity.js';
import { AdditionalMaterialRequest } from '../../additional-request/entities/additional-request.entity.js';
import { User } from '../../users/entities/user.entity.js';

export enum ScStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  STORES_PENDING = 'STORES_PENDING',
  PARTIALLY_ISSUED = 'PARTIALLY_ISSUED',
  ISSUED = 'ISSUED',
  IN_PRODUCTION = 'IN_PRODUCTION',
  ADDITIONAL_REQUEST = 'ADDITIONAL_REQUEST',
  COMPLETED = 'COMPLETED',
}

@Entity('sales_order_components')
export class SalesOrderComponent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'sc_number', length: 100 })
  scNumber!: string;

  @Column({ name: 'po_id' })
  poId!: string;

  @ManyToOne(() => PurchaseOrder, (po) => po.salesOrderComponents, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'po_id' })
  purchaseOrder!: PurchaseOrder;

  @Column({ name: 'product_name', length: 150 })
  productName!: string;

  @Column({ length: 255, nullable: true })
  description?: string;

  @Column({ name: 'drawing_number', length: 100, nullable: true })
  drawingNumber?: string;

  @Column({
    name: 'target_quantity',
    type: 'numeric',
    precision: 12,
    scale: 3,
    default: 1,
  })
  targetQuantity!: number;

  @Index()
  @Column({
    type: 'varchar',
    length: 50,
    default: ScStatus.DRAFT,
  })
  status!: ScStatus;

  @OneToOne(() => RmRequest, (rm) => rm.salesOrderComponent)
  rmRequest?: RmRequest;

  @OneToMany(() => RmItem, (item) => item.salesOrderComponent)
  rmItems!: RmItem[];

  @OneToMany(() => MaterialIssue, (issue) => issue.salesOrderComponent)
  materialIssues!: MaterialIssue[];

  @OneToMany(() => MaterialConsumption, (c) => c.salesOrderComponent)
  materialConsumptions!: MaterialConsumption[];

  @OneToMany(() => MaterialReturn, (r) => r.salesOrderComponent)
  materialReturns!: MaterialReturn[];

  @OneToMany(() => AdditionalMaterialRequest, (r) => r.salesOrderComponent)
  additionalRequests!: AdditionalMaterialRequest[];

  @Column({
    name: 'completed_at',
    type: 'timestamp with time zone',
    nullable: true,
  })
  completedAt?: Date;

  @Column({ name: 'completed_by_id', nullable: true })
  completedById?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'completed_by_id' })
  completedBy?: User;

  @Column({ name: 'completion_remarks', type: 'text', nullable: true })
  completionRemarks?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
