import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import type { WarehouseLocation } from './warehouse-location.entity.js';

@Entity('warehouses')
export class Warehouse {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 50, unique: true })
  code!: string;

  @Column({ length: 100, unique: true })
  name!: string;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @OneToMany('WarehouseLocation', (location: WarehouseLocation) => location.warehouse)
  locations?: WarehouseLocation[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
