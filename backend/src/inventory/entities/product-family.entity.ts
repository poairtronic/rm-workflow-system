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
import { ProductCategory } from './product-category.entity.js';
import type { Product } from './product.entity.js';

@Entity('product_families')
@Unique(['categoryId', 'name'])
export class ProductFamily {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'category_id' })
  categoryId!: string;

  @ManyToOne(() => ProductCategory, (category) => category.families, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'category_id' })
  category!: ProductCategory;

  @Column({ length: 100 })
  name!: string;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @OneToMany('Product', (product: Product) => product.family)
  products?: Product[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
