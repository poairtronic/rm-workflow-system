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
import { Product } from './product.entity.js';

export enum MslAlertStatus {
  ACTIVE = 'ACTIVE',
  RESOLVED = 'RESOLVED',
}

@Entity('msl_alerts')
export class MslAlert {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'product_id' })
  productId!: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  @Column({
    name: 'trigger_quantity',
    type: 'numeric',
    precision: 12,
    scale: 3,
  })
  triggerQuantity!: number;

  @Column({
    name: 'minimum_inventory',
    type: 'numeric',
    precision: 12,
    scale: 3,
  })
  minimumInventory!: number;

  @Column({
    type: 'enum',
    enum: MslAlertStatus,
    default: MslAlertStatus.ACTIVE,
  })
  status!: MslAlertStatus;

  @Column({ name: 'resolved_at', type: 'timestamp with time zone', nullable: true })
  resolvedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
