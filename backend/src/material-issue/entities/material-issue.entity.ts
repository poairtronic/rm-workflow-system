import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { SalesOrderComponent } from '../../sc/entities/sc.entity.js';
import { RmItem } from '../../rm/entities/rm-item.entity.js';
import { User } from '../../users/entities/user.entity.js';
import { ProductionReceipt } from '../../production/entities/production-receipt.entity.js';

export enum IssueType {
  INITIAL = 'INITIAL',
  ADDITIONAL = 'ADDITIONAL',
  EXTRA = 'EXTRA',
}

@Entity('material_issues')
export class MaterialIssue {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'sc_id' })
  scId!: string;

  @ManyToOne(() => SalesOrderComponent, (sc) => sc.materialIssues, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'sc_id' })
  salesOrderComponent!: SalesOrderComponent;

  @Index()
  @Column({ name: 'rm_item_id' })
  rmItemId!: string;

  @ManyToOne(() => RmItem, (item) => item.materialIssues, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'rm_item_id' })
  rmItem!: RmItem;

  @Column({ name: 'issue_quantity', type: 'numeric', precision: 12, scale: 3 })
  issueQuantity!: number;

  @Column({ length: 20, default: 'NOS' })
  unit!: string;

  @Column({
    name: 'issue_type',
    type: 'varchar',
    length: 50,
    default: IssueType.INITIAL,
  })
  issueType!: IssueType;

  @Column({ name: 'heat_number', nullable: true, length: 100 })
  heatNumber?: string;

  @Column({ name: 'batch_number', nullable: true, length: 100 })
  batchNumber?: string;

  @Column({ name: 'issued_by_id' })
  issuedById!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'issued_by_id' })
  issuedBy!: User;

  @Column({ type: 'text', nullable: true })
  remarks?: string;

  @OneToOne(() => ProductionReceipt, (receipt) => receipt.materialIssue)
  productionReceipt?: ProductionReceipt;

  @CreateDateColumn({ name: 'issued_at' })
  issuedAt!: Date;
}
