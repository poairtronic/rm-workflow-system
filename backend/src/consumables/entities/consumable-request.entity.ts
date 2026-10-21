import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import type { ConsumableRequestItem } from './consumable-request-item.entity.js';

export enum ConsumablePaymentMode {
  CASH = 'CASH',
  CREDIT = 'CREDIT',
}

@Entity('consumable_requests')
export class ConsumableRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ name: 'request_code', type: 'varchar', length: 100, unique: true })
  requestCode!: string;

  @Column({
    name: 'payment_mode',
    type: 'enum',
    enum: ConsumablePaymentMode,
    default: ConsumablePaymentMode.CASH,
  })
  paymentMode!: ConsumablePaymentMode;

  @Column({ name: 'end_user_in_velan', type: 'varchar', length: 255, nullable: true })
  endUserInVelan?: string | null;

  @Column({ name: 'requested_by', type: 'varchar', length: 150 })
  requestedBy!: string;

  @Column({ name: 'prepared_by', type: 'varchar', length: 150, nullable: true })
  preparedBy?: string | null;

  @Column({ name: 'verified_by', type: 'varchar', length: 150, nullable: true })
  verifiedBy?: string | null;

  @Column({ name: 'approved_by', type: 'varchar', length: 150, nullable: true })
  approvedBy?: string | null;

  @Column({
    name: 'request_date',
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
  })
  requestDate!: Date;

  @Column({ type: 'text', nullable: true })
  remarks?: string | null;

  @OneToMany('ConsumableRequestItem', (item: ConsumableRequestItem) => item.request, {
    cascade: true,
  })
  items!: ConsumableRequestItem[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt!: Date;
}
