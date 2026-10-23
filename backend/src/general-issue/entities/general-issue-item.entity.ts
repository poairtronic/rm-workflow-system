import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import type { GeneralIssue } from './general-issue.entity.js';
import { Product } from '../../inventory/entities/product.entity.js';
import { Bin } from '../../inventory/entities/bin.entity.js';

@Entity('general_issue_items')
export class GeneralIssueItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'general_issue_id' })
  generalIssueId!: string;

  @ManyToOne('GeneralIssue', (issue: GeneralIssue) => issue.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'general_issue_id' })
  generalIssue!: GeneralIssue;

  @Column({ name: 'product_id' })
  productId!: string;

  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  @Column({ name: 'bin_id', type: 'uuid', nullable: true })
  binId?: string | null;

  @ManyToOne(() => Bin, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'bin_id' })
  bin?: Bin | null;

  @Column({
    name: 'quantity_issued',
    type: 'numeric',
    precision: 12,
    scale: 3,
  })
  quantityIssued!: number;

  @Column({ type: 'text', nullable: true })
  remarks?: string;
}
