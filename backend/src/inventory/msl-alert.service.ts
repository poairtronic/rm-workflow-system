import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MslAlert, MslAlertStatus } from './entities/msl-alert.entity.js';
import {
  MslCalculationService,
  MslStockStatus,
} from './msl-calculation.service.js';
import {
  CommunicationService,
  CommunicationEventResult,
} from '../notifications/communication.service.js';

export type MslAlertAction = 'CREATED' | 'SUPPRESSED' | 'RESOLVED' | 'NONE';

export interface MslAlertEvaluationResult {
  productId: string;
  productName?: string;
  action: MslAlertAction;
  alert: MslAlert | null;
  status?: MslStockStatus;
  currentStock?: number;
  minimumInventory?: number;
  eventResult?: CommunicationEventResult;
}

@Injectable()
export class MslAlertService {
  private readonly logger = new Logger(MslAlertService.name);

  constructor(
    @InjectRepository(MslAlert)
    private readonly mslAlertRepo: Repository<MslAlert>,
    private readonly mslCalculationService: MslCalculationService,
    @Optional()
    private readonly communicationService?: CommunicationService,
  ) {}

  /**
   * Evaluates MSL for a single product, handles alert state transitions,
   * enforces duplicate suppression, and orchestrates notifications.
   */
  async evaluateAndAlertProduct(
    productId: string,
  ): Promise<MslAlertEvaluationResult> {
    const result = await this.mslCalculationService.checkProductMsl(productId);
    if (!result || result.minimumInventory <= 0) {
      return {
        productId,
        action: 'NONE',
        alert: null,
        status: result?.status || MslStockStatus.NORMAL,
        currentStock: result?.currentStock || 0,
      };
    }

    const activeAlert = await this.mslAlertRepo.findOne({
      where: { productId, status: MslAlertStatus.ACTIVE },
    });

    // 1. BREACH DETECTED: OUT_OF_STOCK or LOW_STOCK
    if (
      result.status === MslStockStatus.OUT_OF_STOCK ||
      result.status === MslStockStatus.LOW_STOCK
    ) {
      // DUPLICATE SUPPRESSION: An active alert already exists; do not duplicate
      if (activeAlert) {
        this.logger.debug(
          `[DUPLICATE SUPPRESSION] Active alert already exists for product ${result.productName} (${productId}). Suppressing notification.`,
        );
        return {
          productId,
          productName: result.productName,
          action: 'SUPPRESSED',
          alert: activeAlert,
          status: result.status,
          currentStock: result.currentStock,
          minimumInventory: result.minimumInventory,
        };
      }

      // CREATE NEW ACTIVE ALERT
      const newAlert = this.mslAlertRepo.create({
        productId,
        triggerQuantity: result.currentStock,
        minimumInventory: result.minimumInventory,
        status: MslAlertStatus.ACTIVE,
      });
      const savedAlert = (await this.mslAlertRepo.save(newAlert)) || newAlert;
      this.logger.warn(
        `[MSL ALERT CREATED] Product ${result.productName} breached threshold (${result.currentStock} / ${result.minimumInventory}). Status: ${result.status}`,
      );

      // DISPATCH MULTI-CHANNEL NOTIFICATION
      const eventType =
        result.status === MslStockStatus.OUT_OF_STOCK
          ? 'MSL_OUT_OF_STOCK'
          : 'MSL_LOW_STOCK';

      let eventResult: CommunicationEventResult | undefined;
      if (this.communicationService) {
        try {
          eventResult = await this.communicationService.sendEvent({
            eventType,
            entityType: 'PRODUCT',
            entityId: productId,
            metadata: {
              productName: result.productName,
              currentStock: result.currentStock,
              minimumInventory: result.minimumInventory,
              deficit: result.deficit,
              alertId: savedAlert?.id,
            },
          });
        } catch (commErr: any) {
          this.logger.error(
            `Failed to dispatch communication event for MSL alert ${savedAlert?.id}: ${commErr?.message || commErr}`,
          );
        }
      }

      return {
        productId,
        productName: result.productName,
        action: 'CREATED',
        alert: savedAlert,
        status: result.status,
        currentStock: result.currentStock,
        minimumInventory: result.minimumInventory,
        eventResult,
      };
    }

    // 2. STOCK HEALTHY / RESTORED: Total Stock >= minimumInventory
    if (activeAlert) {
      // AUTOMATIC RESOLUTION
      activeAlert.status = MslAlertStatus.RESOLVED;
      activeAlert.resolvedAt = new Date();
      const resolvedAlert = (await this.mslAlertRepo.save(activeAlert)) || activeAlert;
      this.logger.log(
        `[MSL ALERT RESOLVED] Product ${result.productName} stock restored (${result.currentStock} >= ${result.minimumInventory}). Alert ${resolvedAlert?.id} resolved.`,
      );

      let eventResult: CommunicationEventResult | undefined;
      if (this.communicationService) {
        try {
          eventResult = await this.communicationService.sendEvent({
            eventType: 'MSL_RESOLVED',
            entityType: 'PRODUCT',
            entityId: productId,
            metadata: {
              productName: result.productName,
              currentStock: result.currentStock,
              minimumInventory: result.minimumInventory,
              alertId: resolvedAlert?.id,
            },
          });
        } catch (commErr: any) {
          this.logger.error(
            `Failed to dispatch resolution event for MSL alert ${resolvedAlert?.id}: ${commErr?.message || commErr}`,
          );
        }
      }

      return {
        productId,
        productName: result.productName,
        action: 'RESOLVED',
        alert: resolvedAlert,
        status: result.status,
        currentStock: result.currentStock,
        minimumInventory: result.minimumInventory,
        eventResult,
      };
    }

    // 3. NORMAL STATE: No active alert and stock within normal limits
    return {
      productId,
      productName: result.productName,
      action: 'NONE',
      alert: null,
      status: result.status,
      currentStock: result.currentStock,
      minimumInventory: result.minimumInventory,
    };
  }

  /**
   * Batch evaluates all active monitored products across the enterprise catalogue.
   */
  async evaluateAllAndAlert(): Promise<MslAlertEvaluationResult[]> {
    const calcResults = await this.mslCalculationService.evaluateAllProducts();
    const evaluationResults: MslAlertEvaluationResult[] = [];

    for (const r of calcResults) {
      if (r.minimumInventory > 0) {
        const evalResult = await this.evaluateAndAlertProduct(r.productId);
        evaluationResults.push(evalResult);
      }
    }

    return evaluationResults;
  }

  /**
   * Fetches all currently active MSL alerts.
   */
  async getActiveAlerts(): Promise<MslAlert[]> {
    return this.mslAlertRepo.find({
      where: { status: MslAlertStatus.ACTIVE },
      relations: { product: true },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Fetches full alert history for a specific product.
   */
  async getAlertHistory(productId: string): Promise<MslAlert[]> {
    return this.mslAlertRepo.find({
      where: { productId },
      order: { createdAt: 'DESC' },
    });
  }
}
