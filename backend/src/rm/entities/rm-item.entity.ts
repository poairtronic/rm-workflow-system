import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { RmRequest } from './rm-request.entity.js';
import { MaterialIssue } from '../../material-issue/entities/material-issue.entity.js';
import { MaterialConsumption } from '../../production/entities/material-consumption.entity.js';
import { MaterialReturn } from '../../production/entities/material-return.entity.js';

@Entity('rm_items')
export class RmItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'rm_request_id' })
  rmRequestId!: string;

  @ManyToOne(() => RmRequest, (req) => req.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rm_request_id' })
  rmRequest!: RmRequest;

  @Index()
  @Column({ name: 'sc_id', nullable: true })
  scId?: string;

  @Index()
  @Column({ name: 'material_grade', length: 100 })
  materialGrade!: string;

  @Column({ name: 'profile_type', length: 50, default: 'ROUND_BAR' })
  profileType!: string;

  @Column({ length: 100 })
  size!: string;

  @Column({
    name: 'required_quantity',
    type: 'numeric',
    precision: 12,
    scale: 3,
  })
  requiredQuantity!: number;

  @Column({ length: 20, default: 'NOS' })
  unit!: string;

  /* Flexible Dimensional Attributes */
  @Column({
    name: 'diameter_mm',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  diameterMm?: number;

  @Column({
    name: 'length_mm',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  lengthMm?: number;

  @Column({
    name: 'width_mm',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  widthMm?: number;

  @Column({
    name: 'thickness_mm',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  thicknessMm?: number;

  @Column({
    name: 'unit_weight_kg',
    type: 'numeric',
    precision: 10,
    scale: 3,
    nullable: true,
  })
  unitWeightKg?: number;

  @Column({
    name: 'total_weight_kg',
    type: 'numeric',
    precision: 12,
    scale: 3,
    nullable: true,
  })
  totalWeightKg?: number;

  @Column({ type: 'text', nullable: true })
  remarks?: string;

  @OneToMany(() => MaterialIssue, (issue) => issue.rmItem)
  materialIssues!: MaterialIssue[];

  @OneToMany(() => MaterialConsumption, (cons) => cons.rmItem)
  materialConsumptions!: MaterialConsumption[];

  @OneToMany(() => MaterialReturn, (ret) => ret.rmItem)
  materialReturns!: MaterialReturn[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
