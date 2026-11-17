import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type SettingAuditScope = 'ROLE' | 'USER';

@Entity('email_setting_audit')
export class EmailSettingAudit {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'changed_by', type: 'varchar', length: 100 })
  changedBy!: string;

  @Column({ type: 'varchar', length: 10 })
  scope!: SettingAuditScope;

  @Index('IDX_email_setting_audit_target_id')
  @Column({ name: 'target_id', type: 'uuid' })
  targetId!: string;

  @Column({ name: 'event_code', type: 'varchar', length: 100 })
  eventCode!: string;

  @Column({ name: 'old_value', type: 'varchar', length: 10, nullable: true })
  oldValue?: string | null;

  @Column({ name: 'new_value', type: 'varchar', length: 10 })
  newValue!: string;

  @Index('IDX_email_setting_audit_changed_at')
  @CreateDateColumn({ name: 'changed_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  changedAt!: Date;
}
