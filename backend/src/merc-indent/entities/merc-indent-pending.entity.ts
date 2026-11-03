import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { MercIndentLineItem } from './merc-indent-line-item.entity.js';

@Entity('merc_indent_pending')
export class MercIndentPending {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'indent_id', type: 'varchar' })
  indentId!: string;

  @Column({ name: 'indent_number', type: 'varchar' })
  indentNumber!: string;

  @Column({ name: 'po_number', type: 'varchar', nullable: true })
  poNumber?: string | null;

  @Column({ name: 'customer_name', type: 'varchar', nullable: true })
  customerName?: string | null;

  @Column({ name: 'layout_number', type: 'varchar', nullable: true })
  layoutNumber?: string | null;

  @Column({ type: 'varchar', default: 'PENDING' })
  status!: string;

  @Column({ name: 'merc_current_state', type: 'varchar' })
  mercCurrentState!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;

  @OneToMany(() => MercIndentLineItem, (item) => item.mercIndentPending, {
    cascade: true,
  })
  lineItems!: Relation<MercIndentLineItem>[];
}

export default MercIndentPending;

