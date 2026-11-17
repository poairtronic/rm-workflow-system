import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EmailSkipLog } from './entities/email-skip-log.entity.js';
import { NotificationEvent } from './entities/notification-event.entity.js';
import {
  GetSkipsQueryDto,
  SkipLogEntryInput,
  SkipLogItemDto,
  SkipsResponseDto,
  SkipsSummaryResponseDto,
} from './dto/email-preferences-skip.dto.js';

export const SKIP_REASON_TEXTS: Record<string, string> = {
  OVERRIDE_OFF: 'Turned off for this user by an admin',
  LEGACY_USER_OFF: 'User turned off their own workflow emails',
  ACTOR: 'User performed the action themselves',
  GLOBAL_OFF: 'Global email switch was OFF',
  CONSUMABLE_GATE_OFF: 'Consumable email alerts switch was OFF',
};

export const DEFAULT_SKIP_LOG_RETENTION_DAYS = 30;

@Injectable()
export class EmailSkipLogService {
  private readonly logger = new Logger(EmailSkipLogService.name);

  constructor(
    @InjectRepository(EmailSkipLog)
    private readonly skipLogRepo: Repository<EmailSkipLog>,
    @InjectRepository(NotificationEvent)
    private readonly notificationEventRepo: Repository<NotificationEvent>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Helper to build dedupe key:
   * dedupe_key = `${eventCode}:${entityId || '-'}:${recipientUserId || '-'}:${reason}`;
   */
  generateDedupeKey(entry: SkipLogEntryInput): string {
    const eventCode = entry.eventCode || '-';
    const entityId = entry.entityId || '-';
    const recipientUserId = entry.recipientUserId || '-';
    const reason = entry.reason || '-';
    return `${eventCode}:${entityId}:${recipientUserId}:${reason}`;
  }

  /**
   * Batch insert skip log entries with ON CONFLICT DO NOTHING.
   * Completely non-blocking and safe: catches any error, logs a warning, and NEVER throws.
   */
  async logSkips(entries: SkipLogEntryInput[]): Promise<void> {
    if (!entries || entries.length === 0) return;

    try {
      const records = entries.map((entry) => ({
        eventCode: entry.eventCode,
        recipientUserId: entry.recipientUserId || null,
        recipientName: entry.recipientName || null,
        recipientEmail: entry.recipientEmail || null,
        reason: entry.reason,
        entityId: entry.entityId || null,
        mode: entry.mode,
        dedupeKey: this.generateDedupeKey(entry),
      }));

      // TypeORM queryBuilder with orIgnore() executes INSERT ... ON CONFLICT DO NOTHING in PostgreSQL
      await this.skipLogRepo
        .createQueryBuilder()
        .insert()
        .into(EmailSkipLog)
        .values(records)
        .orIgnore()
        .execute();
    } catch (err: any) {
      this.logger.warn(`Failed to insert email skip logs: ${err?.message || err}`);
    }
  }

  /**
   * List skipped email logs with filters and cursor pagination.
   * Returns newest first.
   */
  async list(filters: GetSkipsQueryDto): Promise<SkipsResponseDto> {
    const limit = Math.min(Math.max(Number(filters.limit) || 20, 1), 100);

    const qb = this.skipLogRepo.createQueryBuilder('skip');

    if (filters.eventCode) {
      qb.andWhere('skip.eventCode = :eventCode', { eventCode: filters.eventCode });
    }

    if (filters.userId) {
      qb.andWhere('skip.recipientUserId = :userId', { userId: filters.userId });
    }

    if (filters.reason) {
      qb.andWhere('skip.reason = :reason', { reason: filters.reason });
    }

    if (filters.from) {
      qb.andWhere('skip.createdAt >= :from', { from: new Date(filters.from) });
    }

    if (filters.to) {
      qb.andWhere('skip.createdAt <= :to', { to: new Date(filters.to) });
    }

    // Cursor pagination (decode base64 { createdAt, id })
    if (filters.cursor) {
      try {
        const decoded = JSON.parse(Buffer.from(filters.cursor, 'base64').toString('utf8'));
        if (decoded.createdAt && decoded.id) {
          qb.andWhere(
            '(skip.createdAt < :cursorCreatedAt OR (skip.createdAt = :cursorCreatedAt AND skip.id < :cursorId))',
            {
              cursorCreatedAt: new Date(decoded.createdAt),
              cursorId: decoded.id,
            },
          );
        }
      } catch {
        // If cursor parsing fails, ignore or treat as invalid cursor
      }
    }

    qb.orderBy('skip.createdAt', 'DESC');
    qb.addOrderBy('skip.id', 'DESC');
    qb.take(limit + 1);

    const rows = await qb.getMany();
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1];
      nextCursor = Buffer.from(
        JSON.stringify({
          createdAt: last.createdAt.toISOString(),
          id: last.id,
        }),
      ).toString('base64');
    }

    // Lookup event labels
    const eventCodes = Array.from(new Set(items.map((i) => i.eventCode)));
    const events =
      eventCodes.length > 0
        ? await this.notificationEventRepo.find({
            where: eventCodes.map((c) => ({ code: c })),
          })
        : [];
    const eventLabelMap = new Map<string, string>();
    for (const ev of events) {
      eventLabelMap.set(ev.code, ev.label);
    }

    const entries: SkipLogItemDto[] = items.map((item) => {
      const eventLabel = eventLabelMap.get(item.eventCode) || item.eventCode;
      const reasonText = SKIP_REASON_TEXTS[item.reason] || item.reason;

      return {
        id: item.id,
        eventCode: item.eventCode,
        eventLabel,
        recipientUserId: item.recipientUserId || null,
        recipientName: item.recipientName || null,
        recipientEmail: item.recipientEmail || null,
        reason: item.reason,
        reasonText,
        entityId: item.entityId || null,
        mode: item.mode,
        createdAt: item.createdAt ? item.createdAt.toISOString() : new Date().toISOString(),
      };
    });

    return {
      entries,
      nextCursor,
    };
  }

  /**
   * Summary of skips grouped by reason and event over the last N days.
   */
  async summary(days: number = 7): Promise<SkipsSummaryResponseDto> {
    const validDays = Math.min(Math.max(Number(days) || 7, 1), 90);
    const cutoff = new Date(Date.now() - validDays * 24 * 60 * 60 * 1000);

    const reasonCountsRaw = await this.skipLogRepo
      .createQueryBuilder('skip')
      .select('skip.reason', 'reason')
      .addSelect('COUNT(*)', 'count')
      .where('skip.createdAt >= :cutoff', { cutoff })
      .groupBy('skip.reason')
      .getRawMany();

    const eventCountsRaw = await this.skipLogRepo
      .createQueryBuilder('skip')
      .select('skip.eventCode', 'eventCode')
      .addSelect('COUNT(*)', 'count')
      .where('skip.createdAt >= :cutoff', { cutoff })
      .groupBy('skip.eventCode')
      .getRawMany();

    const byReason: Record<string, number> = {};
    let total = 0;
    for (const r of reasonCountsRaw) {
      const count = parseInt(r.count, 10) || 0;
      byReason[r.reason] = count;
      total += count;
    }

    const byEvent: Record<string, number> = {};
    for (const e of eventCountsRaw) {
      byEvent[e.eventCode] = parseInt(e.count, 10) || 0;
    }

    return {
      days: validDays,
      byReason,
      byEvent,
      total,
    };
  }

  /**
   * Retention purge: daily cron deletes rows older than retention period from email_skip_log only.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async purgeOld(days: number = DEFAULT_SKIP_LOG_RETENTION_DAYS): Promise<number> {
    try {
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const res = await this.skipLogRepo
        .createQueryBuilder()
        .delete()
        .from(EmailSkipLog)
        .where('created_at < :cutoff', { cutoff })
        .execute();

      const affected = res.affected || 0;
      if (affected > 0) {
        this.logger.log(`Purged ${affected} old email_skip_log records older than ${days} days.`);
      }
      return affected;
    } catch (err: any) {
      this.logger.error(`Failed to purge old email_skip_log records: ${err?.message || err}`);
      return 0;
    }
  }
}
