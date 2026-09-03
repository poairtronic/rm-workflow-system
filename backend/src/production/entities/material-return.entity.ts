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

export enum ReturnStatus {
  PENDING_STORE_ACK = 'PENDING_STORE_ACK',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  REJECTED = 'REJECTED',
}

@Entity('material_returns')
export class MaterialReturn {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'sc_id' })
  scId!: string;

  @ManyToOne(() => SalesOrderComponent, (sc) => sc.materialReturns, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'sc_id' })
  salesOrderComponent!: SalesOrderComponent;

  @Index()
  @Column({ name: 'rm_item_id' })
  rmItemId!: string;

  @ManyToOne(() => RmItem, (item) => item.materialReturns, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'rm_item_id' })
  rmItem!: RmItem;

  @Column({ name: 'return_quantity', type: 'numeric', precision: 12, scale: 3 })
  returnQuantity!: number;

  @Column({ length: 20, default: 'NOS' })
  unit!: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: ReturnStatus.PENDING_STORE_ACK,
  })
  status!: ReturnStatus;

  @Column({ name: 'returned_by_id' })
  returnedById!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'returned_by_id' })
  returnedBy!: User;

  @Column({ name: 'confirmed_by_id', nullable: true })
  confirmedById?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'confirmed_by_id' })
  confirmedBy?: User;

  @Column({
    name: 'confirmed_at',
    type: 'timestamp with time zone',
    nullable: true,
  })
  confirmedAt?: Date;

  @Column({ type: 'text', nullable: true })
  remarks?: string;

  @CreateDateColumn({ name: 'returned_at' })
  returnedAt!: Date;
}
