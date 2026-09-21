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
import type { SalesOrderComponent } from '../../sc/entities/sc.entity.js';
import { User } from '../../users/entities/user.entity.js';
import { MaterialIssueItem } from './material-issue-item.entity.js';
import { AdditionalMaterialRequest } from '../../additional-request/entities/additional-request.entity.js';

export enum MaterialIssueType {
  INITIAL_ISSUE = 'INITIAL_ISSUE',
  ADDITIONAL_ISSUE = 'ADDITIONAL_ISSUE',
}

@Entity('material_issues')
@Index('idx_material_issue_initial', ['scId'], {
  unique: true,
  where: "issue_type = 'INITIAL_ISSUE'",
})
export class MaterialIssue {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'sc_id' })
  scId!: string;

  @ManyToOne(
    'SalesOrderComponent',
    (sc: SalesOrderComponent) => sc.materialIssues,
    {
      onDelete: 'RESTRICT',
    },
  )
  @JoinColumn({ name: 'sc_id' })
  salesOrderComponent!: SalesOrderComponent;

  @Index({ unique: true })
  @Column({ name: 'issue_number', length: 100, unique: true })
  issueNumber!: string;

  @Column({
    name: 'issue_type',
    type: 'varchar',
    length: 50,
    default: MaterialIssueType.INITIAL_ISSUE,
  })
  issueType!: MaterialIssueType;

  @Index()
  @Column({ name: 'additional_request_id', nullable: true })
  additionalRequestId?: string;

  @ManyToOne(() => AdditionalMaterialRequest, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'additional_request_id' })
  additionalRequest?: AdditionalMaterialRequest;

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
