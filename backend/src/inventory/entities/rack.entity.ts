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
import { WarehouseLocation } from './warehouse-location.entity.js';
import type { Bin } from './bin.entity.js';

@Entity('racks')
@Unique(['locationId', 'code'])
export class Rack {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'location_id' })
  locationId!: string;

  @ManyToOne(() => WarehouseLocation, (location) => location.racks, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'location_id' })
  location!: WarehouseLocation;

  @Column({ length: 50 })
  code!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @OneToMany('Bin', (bin: Bin) => bin.rack)
  bins?: Bin[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
