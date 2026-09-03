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
import { SalesOrderComponent } from '../../sc/entities/sc.entity.js';
import { MaterialIssueItem } from '../../material-issue/entities/material-issue-item.entity.js';
import { MaterialConsumption } from '../../production/entities/material-consumption.entity.js';
import { MaterialReturn } from '../../production/entities/material-return.entity.js';

@Entity('rm_items')
export class RmItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'rm_form_id' })
  rmFormId!: string;

  @ManyToOne(() => RmRequest, (req) => req.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rm_form_id' })
  rmRequest!: RmRequest;

  @Index()
  @Column({ name: 'sc_id', nullable: true })
  scId?: string;

  @ManyToOne(() => SalesOrderComponent, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'sc_id' })
  salesOrderComponent?: SalesOrderComponent;

  /* Required Fields */
  @Index()
  @Column({ length: 100 })
  material!: string;

  @Column({ name: 'material_type', length: 50, default: 'ROUND_BAR' })
  materialType!: string;

  @Column({ length: 100 })
  grade!: string;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 3,
  })
  quantity!: number;

  @Column({ length: 100 })
  size!: string;

  /* Optional Flexible Dimensional Fields */
  @Column({
    name: 'length',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  length?: number;

  @Column({
    name: 'width',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  width?: number;

  @Column({
    name: 'thickness',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  thickness?: number;

  @Column({
    name: 'diameter',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  diameter?: number;

  @Column({
    name: 'weight',
    type: 'numeric',
    precision: 12,
    scale: 3,
    nullable: true,
  })
  weight?: number;

  @Column({ name: 'weight_unit', length: 20, default: 'KG' })
  weightUnit!: string;

  @Column({ type: 'text', nullable: true })
  remarks?: string;

  @OneToMany(() => MaterialIssueItem, (item) => item.rmItem)
  materialIssues!: MaterialIssueItem[];

  @OneToMany(() => MaterialConsumption, (cons) => cons.rmItem)
  materialConsumptions!: MaterialConsumption[];

  @OneToMany(() => MaterialReturn, (ret) => ret.rmItem)
  materialReturns!: MaterialReturn[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
