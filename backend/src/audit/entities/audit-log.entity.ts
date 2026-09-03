import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'entity_name', length: 100 })
  entityName!: string;

  @Index()
  @Column({ name: 'entity_id', length: 100 })
  entityId!: string;

  @Column({ name: 'action_type', length: 50 })
  actionType!: string;

  @Column({ name: 'actor_id', nullable: true })
  actorId?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actor_id' })
  actor?: User;

  @Column({ name: 'old_values', type: 'jsonb', nullable: true })
  oldValues?: Record<string, any>;

  @Column({ name: 'new_values', type: 'jsonb', nullable: true })
  newValues?: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Index()
  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
