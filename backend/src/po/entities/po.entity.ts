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
import type { Customer } from '../../customers/entities/customer.entity.js';
import type { SalesOrderComponent } from '../../sc/entities/sc.entity.js';

@Entity('purchase_orders')
export class PurchaseOrder {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ name: 'po_number', unique: true, length: 100 })
  poNumber!: string;

  @Column({ name: 'customer_id' })
  customerId!: string;

  @ManyToOne('Customer', (customer: Customer) => customer.purchaseOrders, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'customer_id' })
  customer!: Customer;

  @Column({ name: 'external_reference', nullable: true, length: 150 })
  externalReference?: string;

  @Column({ name: 'reference_date', type: 'date', nullable: true })
  referenceDate?: Date;

  @Column({ nullable: true, length: 255 })
  remarks?: string;

  @OneToMany(
    'SalesOrderComponent',
    (sc: SalesOrderComponent) => sc.purchaseOrder,
  )
  salesOrderComponents!: SalesOrderComponent[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
