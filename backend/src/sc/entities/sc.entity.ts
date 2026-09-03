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
import { MaterialIssue } from '../../material-issue/entities/material-issue.entity.js';
import { MaterialConsumption } from '../../production/entities/material-consumption.entity.js';
import { MaterialReturn } from '../../production/entities/material-return.entity.js';
import { AdditionalMaterialRequest } from '../../additional-request/entities/additional-request.entity.js';

export enum ScStatus {
  DRAFT = 'DRAFT',
  RM_SUBMITTED = 'RM_SUBMITTED',
  SENIOR_VERIFIED = 'SENIOR_VERIFIED',
  STORES_PENDING = 'STORES_PENDING',
  PARTIALLY_ISSUED = 'PARTIALLY_ISSUED',
  ISSUED = 'ISSUED',
  RECEIVED = 'RECEIVED',
  IN_PRODUCTION = 'IN_PRODUCTION',
  ADDITIONAL_REQUESTED = 'ADDITIONAL_REQUESTED',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
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

  @Column({ name: 'drawing_number', nullable: true, length: 100 })
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

  @OneToOne(() => RmRequest, (rmRequest) => rmRequest.salesOrderComponent)
  rmRequest?: RmRequest;

  @OneToMany(() => MaterialIssue, (issue) => issue.salesOrderComponent)
  materialIssues!: MaterialIssue[];

  @OneToMany(() => MaterialConsumption, (cons) => cons.salesOrderComponent)
  materialConsumptions!: MaterialConsumption[];

  @OneToMany(() => MaterialReturn, (ret) => ret.salesOrderComponent)
  materialReturns!: MaterialReturn[];

  @OneToMany(
    () => AdditionalMaterialRequest,
    (addReq) => addReq.salesOrderComponent,
  )
  additionalRequests!: AdditionalMaterialRequest[];

  @Column({
    name: 'completed_at',
    type: 'timestamp with time zone',
    nullable: true,
  })
  completedAt?: Date;

  @Column({ name: 'completed_by_id', nullable: true })
  completedById?: string;

  @Column({ name: 'completion_remarks', type: 'text', nullable: true })
  completionRemarks?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
