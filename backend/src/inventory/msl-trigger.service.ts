import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  MslAlertService,
  MslAlertEvaluationResult,
} from './msl-alert.service.js';

export interface MslSweepStats {
  totalEvaluated: number;
  created: number;
  suppressed: number;
  resolved: number;
  unaffected: number;
  durationMs: number;
}

@Injectable()
export class MslTriggerService {
  private readonly logger = new Logger(MslTriggerService.name);
  private isSweepActive = false;
  private lastSweepTime: Date | null = null;
  private lastSweepStats: MslSweepStats | null = null;

  constructor(private readonly mslAlertService: MslAlertService) {}

  /**
   * Event-driven trigger: evaluates a single product's MSL status immediately post-commit.
   * WRAPPED IN SAFE TRY/CATCH: This method is guaranteed never to throw, isolating the caller's
   * primary transaction from any background notification or alert failure.
   */
  async triggerProductEvaluation(
    productId: string,
  ): Promise<MslAlertEvaluationResult | null> {
    if (!productId) {
      return null;
    }

    try {
      this.logger.debug(
        `[MSL TRIGGER] Event-driven MSL evaluation triggered for product: ${productId}`,
      );
      const result = await this.mslAlertService.evaluateAndAlertProduct(productId);
      return result;
    } catch (error: any) {
      // Error isolation: Never let MSL alert failure fail the calling inventory transaction
      this.logger.error(
        `[MSL TRIGGER ISOLATION] Failed to evaluate MSL for product ${productId}: ${error?.message || error}`,
        error?.stack,
      );
      return null;
    }
  }

  /**
   * Event-driven trigger for multiple products (e.g., multi-item issue, return, or receipt).
   * Deduplicates product IDs and executes safe evaluation for each.
   */
  async triggerProductsEvaluation(
    productIds: (string | undefined | null)[],
  ): Promise<(MslAlertEvaluationResult | null)[]> {
    const validIds = Array.from(
      new Set(productIds.filter((id): id is string => Boolean(id))),
    );

    if (validIds.length === 0) {
      return [];
    }

    this.logger.debug(
      `[MSL TRIGGER] Batch event-driven MSL evaluation triggered for ${validIds.length} products`,
    );

    const results: (MslAlertEvaluationResult | null)[] = [];
    for (const id of validIds) {
      const res = await this.triggerProductEvaluation(id);
      results.push(res);
    }
    return results;
  }

  /**
   * Scheduled Background Reconciliation Sweep with concurrency/overlap protection.
   * If an existing sweep is in progress, the new invocation skips execution to prevent
   * thread contention and redundant notifications.
   */
  async runScheduledSweep(): Promise<MslAlertEvaluationResult[]> {
    if (this.isSweepActive) {
      this.logger.warn(
        '[MSL CRON] Scheduled sweep skipped: previous reconciliation sweep is still running (concurrency lock active).',
      );
      return [];
    }

    this.isSweepActive = true;
    const startTime = Date.now();
    this.logger.log(
      '[MSL CRON] Starting scheduled enterprise-wide MSL reconciliation sweep.',
    );

    try {
      const results = await this.mslAlertService.evaluateAllAndAlert();

      const durationMs = Date.now() - startTime;
      const stats: MslSweepStats = {
        totalEvaluated: results.length,
        created: results.filter((r) => r.action === 'CREATED').length,
        suppressed: results.filter((r) => r.action === 'SUPPRESSED').length,
        resolved: results.filter((r) => r.action === 'RESOLVED').length,
        unaffected: results.filter((r) => r.action === 'NONE').length,
        durationMs,
      };

      this.lastSweepTime = new Date();
      this.lastSweepStats = stats;

      this.logger.log(
        `[MSL CRON] Sweep completed in ${durationMs}ms. Evaluated: ${stats.totalEvaluated}, Alerts Created: ${stats.created}, Suppressed: ${stats.suppressed}, Resolved: ${stats.resolved}`,
      );

      return results;
    } catch (error: any) {
      this.logger.error(
        `[MSL CRON ERROR] Scheduled reconciliation sweep failed: ${error?.message || error}`,
        error?.stack,
      );
      return [];
    } finally {
      this.isSweepActive = false;
    }
  }

  /**
   * Cron handler triggered periodically (default: hourly, configurable via MSL_CRON_SCHEDULE).
   */
  @Cron(process.env.MSL_CRON_SCHEDULE || CronExpression.EVERY_HOUR)
  async handleScheduledCron(): Promise<void> {
    await this.runScheduledSweep();
  }

  /**
   * Concurrency lock inspector.
   */
  isSweepRunning(): boolean {
    return this.isSweepActive;
  }

  /**
   * Timestamp of last completed background sweep.
   */
  getLastSweepTime(): Date | null {
    return this.lastSweepTime;
  }

  /**
   * Summary metrics of last completed background sweep.
   */
  getLastSweepStats(): MslSweepStats | null {
    return this.lastSweepStats;
  }
}
