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

  @Column({ name: 'lead_time_multiplier', type: 'numeric', precision: 4, scale: 2, default: 1.00, transformer: {
    to: (val?: number) => val,
    from: (val: string | number) => val != null ? Number(val) : 1.00
  }})
  leadTimeMultiplier?: number;

  @Column({ name: 'tolerance_buffer_days', type: 'integer', default: 1 })
  toleranceBufferDays?: number;

  @Column({ name: 'alert_72h', type: 'boolean', default: false })
  alert72h?: boolean;

  @Column({ name: 'alert_48h', type: 'boolean', default: false })
  alert48h?: boolean;

  @Column({ name: 'alert_24h', type: 'boolean', default: true })
  alert24h?: boolean;

  @Column({ name: 'email_alerts_enabled', type: 'boolean', default: true })
  emailAlertsEnabled?: boolean;

  @Column({ name: 'sms_alerts_enabled', type: 'boolean', default: false })
  smsAlertsEnabled?: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
