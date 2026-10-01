import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';
import { SalesOrderComponent } from '../../sc/entities/sc.entity.js';
import { PurchaseOrder } from '../../po/entities/po.entity.js';
import type { GeneralIssueItem } from './general-issue-item.entity.js';

export enum GeneralIssueStatus {
  ISSUED = 'ISSUED',
  CANCELLED = 'CANCELLED',
}

@Entity('general_issues')
export class GeneralIssue {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ name: 'issue_number', length: 100, unique: true })
  issueNumber!: string;

  @Index()
  @Column({ name: 'sc_id', type: 'uuid', nullable: true })
  scId?: string | null;

  @ManyToOne(() => SalesOrderComponent, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sc_id' })
  salesOrderComponent?: SalesOrderComponent | null;

  @Index()
  @Column({ name: 'po_id', type: 'uuid', nullable: true })
  poId?: string | null;

  @ManyToOne(() => PurchaseOrder, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'po_id' })
  purchaseOrder?: PurchaseOrder | null;

  @Column({ length: 100, nullable: true })
  department?: string;

  @Column({ length: 100, nullable: true })
  requester?: string;

  @Column({ length: 255, nullable: true })
  reason?: string;

  @Column({ name: 'external_reference', length: 100, nullable: true })
  externalReference?: string;

  @Column({
    type: 'enum',
    enum: GeneralIssueStatus,
    default: GeneralIssueStatus.ISSUED,
  })
  status!: GeneralIssueStatus;

  @Column({ name: 'issued_by_id' })
  issuedById!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'issued_by_id' })
  issuedBy!: User;

  @Column({
    name: 'issue_date',
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
  })
  issueDate!: Date;

  @Column({ type: 'text', nullable: true })
  remarks?: string;

  @OneToMany('GeneralIssueItem', (item: GeneralIssueItem) => item.generalIssue, {
    cascade: true,
  })
  items!: GeneralIssueItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
