import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { MercIndentPending } from './merc-indent-pending.entity.js';
import { User } from '../../users/entities/user.entity.js';
import { Product } from '../../inventory/entities/product.entity.js';
import { Bin } from '../../inventory/entities/bin.entity.js';

@Entity('merc_indent_line_items')
export class MercIndentLineItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'merc_indent_pending_id', type: 'uuid' })
  mercIndentPendingId!: string;

  @ManyToOne(() => MercIndentPending, (pending) => pending.lineItems, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'merc_indent_pending_id' })
  mercIndentPending?: Relation<MercIndentPending>;

  @Column({ name: 'merc_item_id', type: 'varchar' })
  mercItemId!: string;

  @Column({ name: 'item_type', type: 'varchar' })
  itemType!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar', nullable: true })
  material?: string | null;

  @Column({ type: 'varchar', nullable: true })
  shape?: string | null;

  @Column({ name: 'length_mm', type: 'decimal', nullable: true })
  lengthMm?: number | null;

  @Column({ name: 'width_mm', type: 'decimal', nullable: true })
  widthMm?: number | null;

  @Column({ name: 'height_mm', type: 'decimal', nullable: true })
  heightMm?: number | null;

  @Column({ name: 'diameter_mm', type: 'decimal', nullable: true })
  diameterMm?: number | null;

  @Column({ name: 'quantity_required', type: 'decimal' })
  quantityRequired!: number;

  @Column({ name: 'quantity_issued', type: 'decimal', default: 0 })
  quantityIssued!: number;

  @Column({ type: 'varchar', nullable: true })
  unit?: string | null;

  @Column({ name: 'vendor_name', type: 'varchar', nullable: true })
  vendorName?: string | null;

  @Column({ name: 'source', type: 'varchar', nullable: true })
  source?: string | null;

  @Column({ type: 'varchar', default: 'PENDING' })
  status!: string;

  @Column({ name: 'rm_product_id', type: 'uuid', nullable: true })
  rmProductId?: string | null;

  @ManyToOne(() => Product, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'rm_product_id' })
  rmProduct?: Relation<Product> | null;

  @Column({ name: 'rm_bin_id', type: 'uuid', nullable: true })
  rmBinId?: string | null;

  @ManyToOne(() => Bin, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'rm_bin_id' })
  rmBin?: Relation<Bin> | null;

  @Column({ name: 'issued_at', type: 'timestamp', nullable: true })
  issuedAt?: Date | null;

  @Column({ name: 'issued_by_id', type: 'uuid', nullable: true })
  issuedById?: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'issued_by_id' })
  issuedBy?: Relation<User> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;
}

export default MercIndentLineItem;

