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
import { Rack } from './rack.entity.js';
import type { StockBalance } from './stock-balance.entity.js';
import type { StockTransaction } from './stock-transaction.entity.js';

@Entity('bins')
@Unique(['rackId', 'code'])
export class Bin {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'rack_id' })
  rackId!: string;

  @ManyToOne(() => Rack, (rack) => rack.bins, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'rack_id' })
  rack!: Rack;

  @Column({ length: 50 })
  code!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @OneToMany('StockBalance', (balance: any) => balance.bin)
  stockBalances?: StockBalance[];

  @OneToMany('StockTransaction', (tx: any) => tx.destinationBin)
  destinationTransactions?: StockTransaction[];

  @OneToMany('StockTransaction', (tx: any) => tx.sourceBin)
  sourceTransactions?: StockTransaction[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
