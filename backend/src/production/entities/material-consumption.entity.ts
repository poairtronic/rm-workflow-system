import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { SalesOrderComponent } from '../../sc/entities/sc.entity.js';
import { RmItem } from '../../rm/entities/rm-item.entity.js';
import { User } from '../../users/entities/user.entity.js';

@Entity('material_consumptions')
export class MaterialConsumption {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'sc_id' })
  scId!: string;

  @ManyToOne(() => SalesOrderComponent, (sc) => sc.materialConsumptions, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'sc_id' })
  salesOrderComponent!: SalesOrderComponent;

  @Index()
  @Column({ name: 'rm_item_id' })
  rmItemId!: string;

  @ManyToOne(() => RmItem, (item) => item.materialConsumptions, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'rm_item_id' })
  rmItem!: RmItem;

  @Column({
    name: 'consumed_quantity',
    type: 'numeric',
    precision: 12,
    scale: 3,
  })
  consumedQuantity!: number;

  @Column({ length: 20, default: 'NOS' })
  unit!: string;

  @Column({ name: 'recorded_by_id' })
  recordedById!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'recorded_by_id' })
  recordedBy!: User;

  @Column({ type: 'text', nullable: true })
  remarks?: string;

  @CreateDateColumn({ name: 'recorded_at' })
  recordedAt!: Date;
}
