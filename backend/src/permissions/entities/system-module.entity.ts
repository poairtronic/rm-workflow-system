import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('system_modules')
export class SystemModule {
  @PrimaryColumn({ name: 'module_key', length: 50 })
  moduleKey!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ name: 'group_name', length: 50 })
  groupName!: string;

  @Column({ name: 'route_path', length: 150 })
  routePath!: string;

  @Column({ nullable: true, length: 255 })
  description?: string;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder!: number;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
