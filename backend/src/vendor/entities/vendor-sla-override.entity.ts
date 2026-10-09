import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { VendorSla } from './vendor-sla.entity.js';
import { DeliveryChallan } from '../../delivery-challan/entities/delivery-challan.entity.js';
import { User } from '../../users/entities/user.entity.js';

@Entity('vendor_sla_overrides')
@Index('idx_vendor_sla_overrides_sla_id', ['slaId'])
@Index('idx_vendor_sla_overrides_authorized_by', ['authorizedById'])
export class VendorSlaOverride {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'sla_id', type: 'uuid' })
  slaId: string;

  @ManyToOne(() => VendorSla, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sla_id' })
  sla: VendorSla;

  @Column({ name: 'dc_id', type: 'uuid', nullable: true })
  dcId?: string | null;

  @ManyToOne(() => DeliveryChallan, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'dc_id' })
  deliveryChallan?: DeliveryChallan | null;

  @Column({ name: 'authorized_by_id', type: 'uuid' })
  authorizedById: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'authorized_by_id' })
  authorizedBy: User;

  @Column({ name: 'original_target_date', type: 'timestamptz', nullable: true })
  originalTargetDate?: Date | null;

  @Column({ name: 'new_target_date', type: 'timestamptz' })
  newTargetDate: Date;

  @Column({ name: 'justification_code', type: 'varchar', length: 50 })
  justificationCode: string;

  @Column({ name: 'justification_notes', type: 'text' })
  justificationNotes: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
