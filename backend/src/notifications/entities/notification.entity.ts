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

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ length: 150 })
  title!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({ length: 50, default: 'INFO' })
  type!: string;

  @Column({ name: 'target_entity', nullable: true, length: 50 })
  targetEntity?: string;

  @Column({ name: 'target_id', nullable: true, length: 100 })
  targetId?: string;

  @Index()
  @Column({ name: 'is_read', default: false })
  isRead!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
