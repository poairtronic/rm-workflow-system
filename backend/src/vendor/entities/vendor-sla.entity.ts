import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { Vendor } from './vendor.entity.js';
import { ProductionProcess } from '../../production-process/entities/production-process.entity.js';

@Entity('vendor_slas')
@Unique('UQ_vendor_process_sla', ['vendorId', 'processId'])
@Index('IDX_vendor_slas_vendor_id', ['vendorId'])
@Index('IDX_vendor_slas_process_id', ['processId'])
@Index('IDX_vendor_slas_is_active', ['isActive'])
export class VendorSla {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'vendor_id', type: 'uuid' })
  vendorId: string;

  @ManyToOne(() => Vendor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @Column({ name: 'process_id', type: 'uuid' })
  processId: string;

  @ManyToOne(() => ProductionProcess, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'process_id' })
  process: ProductionProcess;

  @Column({ name: 'sla_days', type: 'integer' })
  slaDays: number;

  @Column({ name: 'effective_date', type: 'timestamptz' })
  effectiveDate: Date;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
