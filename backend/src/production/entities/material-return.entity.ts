import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import type { SalesOrderComponent } from '../../sc/entities/sc.entity.js';
import { User } from '../../users/entities/user.entity.js';
import { MaterialReturnItem } from './material-return-item.entity.js';

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

  @ManyToOne(
    'SalesOrderComponent',
    (sc: SalesOrderComponent) => sc.materialReturns,
    {
      onDelete: 'RESTRICT',
    },
  )
  @JoinColumn({ name: 'sc_id' })
  salesOrderComponent!: SalesOrderComponent;

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

  @OneToMany(() => MaterialReturnItem, (item) => item.materialReturn, {
    cascade: true,
  })
  items!: MaterialReturnItem[];

  @Column({
    name: 'returned_at',
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
  })
  returnedAt!: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
