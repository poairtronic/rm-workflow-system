import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import type { ProductFamily } from './product-family.entity.js';

@Entity('product_categories')
export class ProductCategory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100, unique: true })
  name!: string;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @OneToMany('ProductFamily', (family: ProductFamily) => family.category)
  families?: ProductFamily[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
