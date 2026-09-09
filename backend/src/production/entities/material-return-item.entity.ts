import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import type { MaterialReturn } from './material-return.entity.js';
import type { RmItem } from '../../rm/entities/rm-item.entity.js';

@Entity('material_return_items')
export class MaterialReturnItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'material_return_id' })
  materialReturnId!: string;

  @ManyToOne('MaterialReturn', (ret: MaterialReturn) => ret.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'material_return_id' })
  materialReturn!: MaterialReturn;

  @Index()
  @Column({ name: 'rm_item_id' })
  rmItemId!: string;

  @ManyToOne('RmItem', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'rm_item_id' })
  rmItem!: RmItem;

  @Column({
    name: 'quantity_returned',
    type: 'numeric',
    precision: 12,
    scale: 3,
  })
  quantityReturned!: number;

  @Column({ type: 'text', nullable: true })
  remarks?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
