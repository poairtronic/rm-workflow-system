import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Warehouse } from './warehouse.entity.js';
import type { Rack } from './rack.entity.js';

@Entity('warehouse_locations')
@Unique(['warehouseId', 'code'])
export class WarehouseLocation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'warehouse_id' })
  warehouseId!: string;

  @ManyToOne(() => Warehouse, (warehouse) => warehouse.locations, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse!: Warehouse;

  @Column({ length: 50 })
  code!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @OneToMany('Rack', (rack: Rack) => rack.location)
  racks?: Rack[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
