import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import type { AdditionalMaterialRequest } from './additional-request.entity.js';
import { RmItem } from '../../rm/entities/rm-item.entity.js';

@Entity('additional_material_request_items')
export class AdditionalMaterialRequestItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'request_id' })
  requestId!: string;

  @ManyToOne(
    'AdditionalMaterialRequest',
    (req: AdditionalMaterialRequest) => req.items,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'request_id' })
  request!: AdditionalMaterialRequest;

  @Index()
  @Column({ name: 'rm_item_id' })
  rmItemId!: string;

  @ManyToOne(() => RmItem, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'rm_item_id' })
  rmItem!: RmItem;

  @Column({
    name: 'quantity_requested',
    type: 'numeric',
    precision: 12,
    scale: 3,
  })
  quantityRequested!: number;

  @Column({
    name: 'quantity_approved',
    type: 'numeric',
    precision: 12,
    scale: 3,
    nullable: true,
  })
  quantityApproved?: number;

  @Column({ type: 'text', nullable: true })
  remarks?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
