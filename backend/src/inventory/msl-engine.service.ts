import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Product } from './entities/product.entity.js';
import { StockBalance } from './entities/stock-balance.entity.js';
import { MslAlert, MslAlertStatus } from './entities/msl-alert.entity.js';
import { MslCalculationService, MslCalculationResult } from './msl-calculation.service.js';

@Injectable()
export class MslEngineService {
  private readonly logger = new Logger(MslEngineService.name);
  private readonly mslCalculationService: MslCalculationService;

  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(StockBalance)
    private readonly stockBalanceRepo: Repository<StockBalance>,
    @InjectRepository(MslAlert)
    private readonly mslAlertRepo: Repository<MslAlert>,
    @Optional()
    mslCalculationService?: MslCalculationService,
  ) {
    this.mslCalculationService =
      mslCalculationService ||
      new MslCalculationService(this.productRepo, this.stockBalanceRepo);
  }

  /**
   * Check MSL for a specific product on demand.
   */
  async checkProductMsl(productId: string): Promise<MslCalculationResult | null> {
    return this.mslCalculationService.checkProductMsl(productId);
  }

  /**
   * Batch evaluate all active products.
   */
  async evaluateAllProducts(): Promise<MslCalculationResult[]> {
    return this.mslCalculationService.evaluateAllProducts();
  }

  async evaluateMslForProduct(productId: string) {
    const product = await this.productRepo.findOne({ where: { id: productId } });
    if (!product || !product.isActive || product.minimumInventory <= 0) {
      return;
    }

    const balances = await this.stockBalanceRepo.find({ where: { productId } });
    const totalStock = balances.reduce((sum, b) => sum + Number(b.currentQuantity), 0);
    
    const activeAlert = await this.mslAlertRepo.findOne({
      where: { productId, status: MslAlertStatus.ACTIVE },
    });

    if (totalStock < product.minimumInventory) {
      if (!activeAlert) {
        // Trigger alert
        const alert = this.mslAlertRepo.create({
          productId,
          triggerQuantity: totalStock,
          minimumInventory: product.minimumInventory,
          status: MslAlertStatus.ACTIVE,
        });
        await this.mslAlertRepo.save(alert);
        this.logger.warn(`MSL triggered for Product ${product.name}. Stock: ${totalStock}, MSL: ${product.minimumInventory}`);
        
        // TODO: integrate with notifications module
      }
    } else {
      if (activeAlert) {
        // Resolve alert
        activeAlert.status = MslAlertStatus.RESOLVED;
        activeAlert.resolvedAt = new Date();
        await this.mslAlertRepo.save(activeAlert);
        this.logger.log(`MSL resolved for Product ${product.name}. Stock: ${totalStock}, MSL: ${product.minimumInventory}`);
      }
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async evaluateAll() {
    this.logger.log('Running scheduled MSL evaluation');
    const products = await this.productRepo.find({ where: { isActive: true } });
    for (const p of products) {
      if (p.minimumInventory > 0) {
        await this.evaluateMslForProduct(p.id);
      }
    }
  }
}
