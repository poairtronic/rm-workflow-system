import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { RmRequest } from './rm-request.entity.js';
import { SalesOrderComponent } from '../../sc/entities/sc.entity.js';

@Entity('rm_form_scs')
@Unique(['rmFormId', 'scId'])
export class RmFormSc {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'rm_form_id' })
  rmFormId!: string;

  @ManyToOne(() => RmRequest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rm_form_id' })
  rmForm!: RmRequest;

  @Index()
  @Column({ name: 'sc_id' })
  scId!: string;

  @ManyToOne(() => SalesOrderComponent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sc_id' })
  salesOrderComponent!: SalesOrderComponent;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
