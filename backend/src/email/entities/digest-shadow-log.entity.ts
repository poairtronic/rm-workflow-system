import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('digest_shadow_log')
@Index('IDX_digest_shadow_log_event_created', ['eventCode', 'createdAt'])
export class DigestShadowLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'event_code', type: 'varchar', length: 64 })
  eventCode!: string;

  @Column({ name: 'recipient_user_id', type: 'uuid' })
  recipientUserId!: string;

  @Column({ name: 'recipient_email', type: 'varchar', length: 255 })
  recipientEmail!: string;

  @Column({ name: 'item_count', type: 'integer' })
  itemCount!: number;

  @Column({ name: 'item_ids', type: 'jsonb' })
  itemIds!: string[];

  @Column({ type: 'varchar', length: 255 })
  subject!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
