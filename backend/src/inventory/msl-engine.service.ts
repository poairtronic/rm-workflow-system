import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity.js';
import { StockBalance } from './entities/stock-balance.entity.js';
import { MslAlert } from './entities/msl-alert.entity.js';
import { MslCalculationService, MslCalculationResult } from './msl-calculation.service.js';
import { MslAlertService, MslAlertEvaluationResult } from './msl-alert.service.js';
import { MslTriggerService } from './msl-trigger.service.js';

@Injectable()
export class MslEngineService {
  private readonly logger = new Logger(MslEngineService.name);
  private readonly mslCalculationService: MslCalculationService;
  private readonly mslAlertService: MslAlertService;
  private readonly mslTriggerService: MslTriggerService;

  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(StockBalance)
    private readonly stockBalanceRepo: Repository<StockBalance>,
    @InjectRepository(MslAlert)
    private readonly mslAlertRepo: Repository<MslAlert>,
    @Optional()
    mslCalculationService?: MslCalculationService,
    @Optional()
    mslAlertService?: MslAlertService,
    @Optional()
    mslTriggerService?: MslTriggerService,
  ) {
    this.mslCalculationService =
      mslCalculationService ||
      new MslCalculationService(this.productRepo, this.stockBalanceRepo);

    this.mslAlertService =
      mslAlertService ||
      new MslAlertService(
        this.mslAlertRepo,
        this.mslCalculationService,
      );

    this.mslTriggerService =
      mslTriggerService ||
      new MslTriggerService(this.mslAlertService);
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

  /**
   * Evaluates MSL for a product and manages active alert lifecycle.
   */
  async evaluateMslForProduct(productId: string): Promise<MslAlertEvaluationResult | null> {
    return this.mslTriggerService.triggerProductEvaluation(productId);
  }

  /**
   * Scheduled/batch sweep of all active products with overlap protection.
   */
  async evaluateAll(): Promise<MslAlertEvaluationResult[]> {
    return this.mslTriggerService.runScheduledSweep();
  }
}

