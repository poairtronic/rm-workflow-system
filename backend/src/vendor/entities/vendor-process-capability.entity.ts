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

@Entity('vendor_process_capabilities')
@Unique('UQ_vendor_process', ['vendorId', 'processId'])
@Index('IDX_vpc_vendor_id', ['vendorId'])
@Index('IDX_vpc_process_id', ['processId'])
@Index('IDX_vpc_is_approved', ['isApproved'])
export class VendorProcessCapability {
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

  @Column({ name: 'is_approved', type: 'boolean', default: true })
  isApproved: boolean;

  @Column({ name: 'lead_time_days', type: 'integer', nullable: true })
  leadTimeDays?: number | null;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

