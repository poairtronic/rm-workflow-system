import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { User } from '../../users/entities/user.entity.js';
import { StockTransaction } from '../../inventory/entities/stock-transaction.entity.js';

@Entity('ecr_material_pending')
export class EcrMaterialPending {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'ecr_id', type: 'varchar' })
  ecrId!: string;

  @Column({ name: 'report_number', type: 'varchar' })
  reportNumber!: string;

  @Column({ type: 'varchar' })
  type!: string;

  @Column({ name: 'sc_number', type: 'varchar' })
  scNumber!: string;

  @Column({ name: 'po_number', type: 'varchar' })
  poNumber!: string;

  @Column({ type: 'varchar' })
  component!: string;

  @Column({ name: 'quantity_affected', type: 'integer' })
  quantityAffected!: number;

  @Column({ type: 'varchar', default: 'PENDING' })
  status!: string;

  @Column({ name: 'issued_at', type: 'timestamp', nullable: true })
  issuedAt?: Date | null;

  @Column({ name: 'issued_by_id', type: 'uuid', nullable: true })
  issuedById?: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'issued_by_id' })
  issuedBy?: Relation<User> | null;

  @Column({ name: 'stock_transaction_id', type: 'uuid', nullable: true })
  stockTransactionId?: string | null;

  @ManyToOne(() => StockTransaction, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'stock_transaction_id' })
  stockTransaction?: Relation<StockTransaction> | null;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approvedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;
}

export default EcrMaterialPending;

