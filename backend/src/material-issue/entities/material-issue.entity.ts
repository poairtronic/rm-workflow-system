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
import { SalesOrderComponent } from '../../sc/entities/sc.entity.js';
import { User } from '../../users/entities/user.entity.js';
import { MaterialIssueItem } from './material-issue-item.entity.js';

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

  @Index({ unique: true })
  @Column({ name: 'issue_number', length: 100, unique: true })
  issueNumber!: string;

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

  @OneToMany(() => MaterialIssueItem, (item) => item.materialIssue, {
    cascade: true,
  })
  items!: MaterialIssueItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
