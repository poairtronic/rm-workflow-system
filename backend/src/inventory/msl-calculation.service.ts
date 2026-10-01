import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity.js';
import { StockBalance } from './entities/stock-balance.entity.js';

export enum MslStockStatus {
  NORMAL = 'NORMAL',
  LOW_STOCK = 'LOW_STOCK',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
  EXCESS = 'EXCESS',
}

export interface MslCalculationResult {
  productId: string;
  productName: string;
  familyId?: string;
  currentStock: number;
  minimumInventory: number;
  maximumInventory: number | null;
  status: MslStockStatus;
  isBreached: boolean;
  deficit?: number;
  excess?: number;
}

/**
 * Pure function to derive stock threshold status based on MSL rules.
 * 
 * Rules:
 * - If Product has minimumInventory > 0:
 *   - If Total Stock <= 0 => OUT_OF_STOCK
 *   - If 0 < Total Stock < Product.minimumInventory => LOW_STOCK
 * - If Product.maximumInventory IS NOT NULL and Total Stock > Product.maximumInventory => EXCESS
 * - Otherwise => NORMAL
 * - Products with minimumInventory == 0 default to NORMAL (unconfigured MSL) unless maximumInventory is exceeded.
 */
export function deriveMslStatus(
  currentStock: number,
  minimumInventory: number,
  maximumInventory?: number | null,
): MslStockStatus {
  const stock = Number(currentStock) || 0;
  const min = Number(minimumInventory) || 0;
  const max =
    maximumInventory !== null && maximumInventory !== undefined
      ? Number(maximumInventory)
      : null;

  // 1. Minimum stock level evaluation (only applies if minimumInventory > 0)
  if (min > 0) {
    if (stock <= 0) {
      return MslStockStatus.OUT_OF_STOCK;
    }
    if (stock < min) {
      return MslStockStatus.LOW_STOCK;
    }
  }

  // 2. Maximum stock level evaluation (only applies if maximumInventory is set)
  if (max !== null && stock > max) {
    return MslStockStatus.EXCESS;
  }

  // 3. Otherwise normal stock level
  return MslStockStatus.NORMAL;
}

/**
 * Pure function to construct a complete MslCalculationResult object.
 */
export function computeMslResult(
  product: {
    id: string;
    name: string;
    familyId?: string;
    minimumInventory: number;
    maximumInventory?: number | null;
  },
  currentStock: number,
): MslCalculationResult {
  const stock = Number(currentStock) || 0;
  const min = Number(product.minimumInventory) || 0;
  const max =
    product.maximumInventory !== null && product.maximumInventory !== undefined
      ? Number(product.maximumInventory)
      : null;

  const status = deriveMslStatus(stock, min, max);
  const isBreached = status !== MslStockStatus.NORMAL;

  let deficit: number | undefined;
  if (status === MslStockStatus.OUT_OF_STOCK || status === MslStockStatus.LOW_STOCK) {
    deficit = Math.max(0, min - stock);
  }

  let excess: number | undefined;
  if (status === MslStockStatus.EXCESS && max !== null) {
    excess = Math.max(0, stock - max);
  }

  return {
    productId: product.id,
    productName: product.name,
    familyId: product.familyId,
    currentStock: stock,
    minimumInventory: min,
    maximumInventory: max,
    status,
    isBreached,
    deficit,
    excess,
  };
}

@Injectable()
export class MslCalculationService {
  private readonly logger = new Logger(MslCalculationService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(StockBalance)
    private readonly stockBalanceRepo: Repository<StockBalance>,
  ) {}

  /**
   * Derive status directly using instance method.
   */
  deriveStatus(
    currentStock: number,
    minimumInventory: number,
    maximumInventory?: number | null,
  ): MslStockStatus {
    return deriveMslStatus(currentStock, minimumInventory, maximumInventory);
  }

  /**
   * Compute full MslCalculationResult for a given product and current stock quantity.
   */
  computeProductResult(product: Product, currentStock: number): MslCalculationResult {
    return computeMslResult(product, currentStock);
  }

  /**
   * Computes enterprise total stock for a product across all storage bins.
   * Total Stock = sum(StockBalance.currentQuantity) for productId.
   */
  async getProductStock(productId: string): Promise<number> {
    const balances = await this.stockBalanceRepo.find({ where: { productId } });
    return balances.reduce((sum, b) => sum + Number(b.currentQuantity || 0), 0);
  }

  /**
   * Evaluates MSL status for a single product on demand.
   * Returns null if product is not found.
   */
  async checkProductMsl(productId: string): Promise<MslCalculationResult | null> {
    const product = await this.productRepo.findOne({ where: { id: productId } });
    if (!product) {
      return null;
    }

    const currentStock = await this.getProductStock(productId);
    return computeMslResult(product, currentStock);
  }

  /**
   * Batch evaluation: scans all active products, aggregates multi-bin stock,
   * and computes MSL statuses for the entire enterprise catalogue.
   */
  async evaluateAllProducts(): Promise<MslCalculationResult[]> {
    this.logger.debug('Running batch MSL evaluation for all active products');

    const products = await this.productRepo.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });

    if (products.length === 0) {
      return [];
    }

    // Aggregate stock balances grouped by product
    const allBalances = await this.stockBalanceRepo.find();
    const stockMap = new Map<string, number>();

    for (const b of allBalances) {
      if (b.productId) {
        const existing = stockMap.get(b.productId) || 0;
        stockMap.set(b.productId, existing + Number(b.currentQuantity || 0));
      }
    }

    return products.map((product) => {
      const stock = stockMap.get(product.id) || 0;
      return computeMslResult(product, stock);
    });
  }

  /**
   * Batch evaluation: returns only products currently breaching thresholds
   * (OUT_OF_STOCK, LOW_STOCK, or EXCESS).
   */
  async getBreachedProducts(): Promise<MslCalculationResult[]> {
    const all = await this.evaluateAllProducts();
    return all.filter((r) => r.isBreached);
  }
}
