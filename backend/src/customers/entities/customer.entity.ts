import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { PurchaseOrder } from '../../po/entities/po.entity.js';

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ length: 150 })
  name!: string;

  @Index({ unique: true })
  @Column({ unique: true, length: 50 })
  code!: string;

  @Column({ name: 'contact_person', nullable: true, length: 100 })
  contactPerson?: string;

  @Column({ nullable: true, length: 150 })
  email?: string;

  @Column({ nullable: true, length: 50 })
  phone?: string;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @OneToMany(() => PurchaseOrder, (po) => po.customer)
  purchaseOrders!: PurchaseOrder[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
