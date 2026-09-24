import { Injectable } from '@nestjs/common';

export interface IdempotencyKeyParams {
  eventType: string;
  entityId: string;
  recipientUserId?: string | null;
}

@Injectable()
export class EmailIdempotencyService {
  /**
   * Generates a deterministic, collision-resistant, human-debuggable idempotency key for email events.
   * Standard Format: <EVENT_TYPE>:<ENTITY_ID> or <EVENT_TYPE>:<ENTITY_ID>:<RECIPIENT_USER_ID>
   */
  generateKey(params: IdempotencyKeyParams): string;
  generateKey(eventType: string, entityId: string, recipientUserId?: string | null): string;
  generateKey(
    paramOrEventType: string | IdempotencyKeyParams,
    entityIdObj?: string,
    recipientUserIdObj?: string | null,
  ): string {
    let eventType: string;
    let entityId: string;
    let recipientUserId: string | null | undefined;

    if (typeof paramOrEventType === 'object' && paramOrEventType !== null) {
      eventType = paramOrEventType.eventType;
      entityId = paramOrEventType.entityId;
      recipientUserId = paramOrEventType.recipientUserId;
    } else {
      eventType = paramOrEventType;
      entityId = entityIdObj!;
      recipientUserId = recipientUserIdObj;
    }

    const cleanEventType = (eventType || 'GENERIC_EVENT').trim().toUpperCase();
    const cleanEntityId = (entityId || 'GLOBAL').trim();
    const cleanRecipient = recipientUserId ? recipientUserId.trim() : '';

    let key = cleanRecipient
      ? `${cleanEventType}:${cleanEntityId}:${cleanRecipient}`
      : `${cleanEventType}:${cleanEntityId}`;

    // Truncate to maximum database column length (255 chars) safely
    if (key.length > 255) {
      key = key.substring(0, 255);
    }

    return key;
  }

  /**
   * Parses an idempotency key into its components if formatted according to standard conventions.
   */
  parseKey(key: string): { eventType: string; entityId: string; recipientUserId?: string } {
    if (!key) {
      return { eventType: 'UNKNOWN', entityId: 'UNKNOWN' };
    }

    const parts = key.split(':');
    if (parts.length >= 3) {
      return {
        eventType: parts[0],
        entityId: parts[1],
        recipientUserId: parts.slice(2).join(':'),
      };
    } else if (parts.length === 2) {
      return {
        eventType: parts[0],
        entityId: parts[1],
      };
    }

    return { eventType: 'RAW', entityId: key };
  }
}
