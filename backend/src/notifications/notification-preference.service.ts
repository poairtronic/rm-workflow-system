import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationEvent } from './entities/notification-event.entity.js';
import { RoleEmailSetting } from './entities/role-email-setting.entity.js';
import { UserEmailOverride } from './entities/user-email-override.entity.js';
import { UserNotificationPreference } from './entities/user-notification-preference.entity.js';
import { SystemSetting } from './entities/system-setting.entity.js';
import { User } from '../users/entities/user.entity.js';
import { evaluateUserPreference } from './user-preference-decision.js';

export const EVENT_ALIAS_MAP: Record<string, string> = {
  ADDITIONAL_MATERIAL_REQUESTED: 'ADDITIONAL_REQUEST',
};

export const EMAIL_PREFS_V2_MODE_KEY = 'EMAIL_PREFS_V2_MODE';
export type EmailPrefsMode = 'OFF' | 'SHADOW' | 'ON';

export interface RecipientSkipItem {
  user: User;
  reason: 'OVERRIDE_OFF' | 'LEGACY_USER_OFF' | 'ACTOR';
}

export interface DetailedRecipientResolution {
  recipients: User[];
  skipped: RecipientSkipItem[];
}

@Injectable()
export class NotificationPreferenceService {
  private readonly logger = new Logger(NotificationPreferenceService.name);

  constructor(
    @InjectRepository(NotificationEvent)
    private readonly notificationEventRepository: Repository<NotificationEvent>,
    @InjectRepository(RoleEmailSetting)
    private readonly roleEmailSettingRepository: Repository<RoleEmailSetting>,
    @InjectRepository(UserEmailOverride)
    private readonly userEmailOverrideRepository: Repository<UserEmailOverride>,
    @InjectRepository(UserNotificationPreference)
    private readonly userPrefRepository: Repository<UserNotificationPreference>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(SystemSetting)
    private readonly systemSettingRepository: Repository<SystemSetting>,
  ) {}

  private cachedMode: EmailPrefsMode | null = null;
  private cachedModeAt: number = 0;
  private readonly MODE_CACHE_TTL_MS = 30_000;

  /**
   * Resets the in-memory mode cache (useful for testing or cache invalidation).
   */
  clearModeCache(): void {
    this.cachedMode = null;
    this.cachedModeAt = 0;
  }

  /**
   * Reads EMAIL_PREFS_V2_MODE from system_settings (read-only, no insert).
   * Cached in memory with a 30s TTL so mode OFF costs zero DB queries,
   * while flips in system_settings take effect within 30 seconds.
   * If missing, falls back to env var EMAIL_PREFS_V2_MODE, else 'OFF'.
   */
  async getMode(): Promise<EmailPrefsMode> {
    const now = Date.now();
    if (this.cachedMode !== null && now - this.cachedModeAt < this.MODE_CACHE_TTL_MS) {
      return this.cachedMode;
    }

    let resolvedMode: EmailPrefsMode = 'OFF';
    try {
      const setting = await this.systemSettingRepository.findOne({
        where: { key: EMAIL_PREFS_V2_MODE_KEY },
      });
      if (setting && setting.value) {
        const val = String(setting.value).trim().toUpperCase();
        if (val === 'ON' || val === 'SHADOW' || val === 'OFF') {
          resolvedMode = val as EmailPrefsMode;
        }
      } else {
        const envVal = process.env.EMAIL_PREFS_V2_MODE?.trim().toUpperCase();
        if (envVal === 'ON' || envVal === 'SHADOW' || envVal === 'OFF') {
          resolvedMode = envVal as EmailPrefsMode;
        }
      }
    } catch (err: any) {
      this.logger.warn(
        `Failed to read ${EMAIL_PREFS_V2_MODE_KEY} from system_settings: ${err?.message || err}`,
      );
      const envVal = process.env.EMAIL_PREFS_V2_MODE?.trim().toUpperCase();
      if (envVal === 'ON' || envVal === 'SHADOW' || envVal === 'OFF') {
        resolvedMode = envVal as EmailPrefsMode;
      }
    }

    this.cachedMode = resolvedMode;
    this.cachedModeAt = now;
    return resolvedMode;
  }

  /**
   * Resolves authorized recipients and skipped eligible users for a given email event.
   * Exactly 4 queries per call, no per-user queries.
   * Returns DetailedRecipientResolution on success, or null if event is non-configurable or unknown.
   */
  async resolveRecipientsDetailed(
    eventType: string,
    actorUserId?: string,
  ): Promise<DetailedRecipientResolution | null> {
    // 1. Normalize eventType via alias map
    const normalizedCode = EVENT_ALIAS_MAP[eventType] || eventType;

    // 2. If event is not in notification_events or is_configurable = false, return null
    const eventDef = await this.notificationEventRepository.findOne({
      where: { code: normalizedCode },
    });

    if (!eventDef || !eventDef.isConfigurable) {
      this.logger.debug(
        `[NotificationPreference] Event "${normalizedCode}" is not registered or not configurable. Returning null.`,
      );
      return null;
    }

    // 3. Exactly 4 queries per call, no per-user queries:
    // a. all active users with role
    // b. role_email_settings for the event
    // c. user_email_overrides for the event
    // d. user_notification_preferences where workflow_email_enabled = false
    const [activeUsers, roleSettings, overrides, disabledPrefs] =
      await Promise.all([
        this.userRepository.find({
          where: { isActive: true },
          relations: { role: true },
        }),
        this.roleEmailSettingRepository.find({
          where: { eventCode: normalizedCode },
        }),
        this.userEmailOverrideRepository.find({
          where: { eventCode: normalizedCode },
        }),
        this.userPrefRepository.find({
          where: { workflowEmailEnabled: false },
        }),
      ]);

    // Build lookup structures
    const roleEnabledMap = new Map<string, boolean>();
    for (const rs of roleSettings) {
      roleEnabledMap.set(rs.roleId, rs.enabled);
    }

    const userOverrideMap = new Map<string, 'ON' | 'OFF'>();
    for (const ov of overrides) {
      userOverrideMap.set(ov.userId, ov.state as 'ON' | 'OFF');
    }

    const legacyDisabledUserSet = new Set<string>();
    for (const pref of disabledPrefs) {
      legacyDisabledUserSet.add(pref.userId);
    }

    // 4. Decision per user, strictly in order:
    // 1. override ON -> include
    // 2. override OFF -> exclude (reason OVERRIDE_OFF)
    // 3. legacy workflow_email_enabled = false -> exclude (reason LEGACY_USER_OFF)
    // 4. role setting enabled -> include, else exclude (reason ROLE_OFF)
    // 5. exclude actorUserId (reason ACTOR)
    // Inactive users are never included.
    const recipients: User[] = [];
    const skipped: RecipientSkipItem[] = [];
    let excludedCount = 0;

    for (const user of activeUsers) {
      if (!user.isActive) {
        excludedCount++;
        this.logger.debug(
          `[NotificationPreference] User ${user.id} (${user.email || 'no-email'}) excluded from ${normalizedCode}: INACTIVE`,
        );
        continue;
      }

      const override = userOverrideMap.get(user.id);
      const isLegacyDisabled = legacyDisabledUserSet.has(user.id);
      const roleId = user.roleId || user.role?.id;
      const isRoleEnabled = roleId ? roleEnabledMap.get(roleId) === true : false;

      const decision = evaluateUserPreference({
        overrideState: override,
        legacyEmailOff: isLegacyDisabled,
        roleEnabled: isRoleEnabled,
      });

      let isIncluded = decision.effective;
      let reason: string | null = isIncluded ? null : decision.source;

      // 5. exclude actorUserId (reason ACTOR)
      if (isIncluded && actorUserId && user.id === actorUserId) {
        isIncluded = false;
        reason = 'ACTOR';
      }

      if (isIncluded) {
        recipients.push(user);
      } else {
        excludedCount++;
        this.logger.debug(
          `[NotificationPreference] User ${user.id} (${user.email || 'no-email'}) excluded from ${normalizedCode}: ${reason}`,
        );

        // Only record meaningful skips (where user's role was ON)
        if (
          isRoleEnabled &&
          (reason === 'OVERRIDE_OFF' || reason === 'LEGACY_USER_OFF' || reason === 'ACTOR')
        ) {
          skipped.push({
            user,
            reason: reason as 'OVERRIDE_OFF' | 'LEGACY_USER_OFF' | 'ACTOR',
          });
        }
      }
    }

    // One-line summary per call at log level
    this.logger.log(
      `[NotificationPreference] event=${normalizedCode} active_users=${activeUsers.length} recipients=${recipients.length} excluded=${excludedCount} skipped_logged=${skipped.length}`,
    );

    return { recipients, skipped };
  }

  /**
   * Resolves authorized recipients for a given email event.
   * Exactly 4 queries per call, no per-user queries.
   * Returns User[] on success, or null if event is non-configurable or unknown (caller keeps old behavior).
   */
  async resolveRecipients(
    eventType: string,
    actorUserId?: string,
  ): Promise<User[] | null> {
    const detailed = await this.resolveRecipientsDetailed(eventType, actorUserId);
    return detailed ? detailed.recipients : null;
  }

  /**
   * Evaluates whether a specific user is eligible to receive an email for an event,
   * respecting overrides, legacy preferences, and role settings.
   */
  async isUserEligibleForEvent(
    userOrId: User | string,
    eventType: string,
  ): Promise<{ eligible: boolean; reason?: string; user?: User }> {
    const normalizedCode = EVENT_ALIAS_MAP[eventType] || eventType;

    let user: User | null = null;
    if (typeof userOrId === 'string') {
      user = await this.userRepository.findOne({
        where: { id: userOrId },
        relations: { role: true },
      });
    } else {
      user = userOrId;
      if (!user.role && user.roleId) {
        user =
          (await this.userRepository.findOne({
            where: { id: user.id },
            relations: { role: true },
          })) || user;
      }
    }

    if (!user || !user.isActive) {
      return { eligible: false, reason: 'INACTIVE', user: user || undefined };
    }

    const mode = await this.getMode();

    if (mode === 'OFF') {
      const disabledPref = await this.userPrefRepository.findOne({
        where: { userId: user.id, workflowEmailEnabled: false },
      });
      if (disabledPref) {
        return { eligible: false, reason: 'PREF_OFF', user };
      }
      return { eligible: true, user };
    }

    const [override, legacyDisabled, roleSetting] = await Promise.all([
      this.userEmailOverrideRepository.findOne({
        where: { userId: user.id, eventCode: normalizedCode },
      }),
      this.userPrefRepository.findOne({
        where: { userId: user.id, workflowEmailEnabled: false },
      }),
      user.roleId
        ? this.roleEmailSettingRepository.findOne({
            where: { roleId: user.roleId, eventCode: normalizedCode },
          })
        : null,
    ]);

    const decision = evaluateUserPreference({
      overrideState: override?.state,
      legacyEmailOff: Boolean(legacyDisabled),
      roleEnabled: roleSetting ? roleSetting.enabled : true,
    });

    if (decision.effective) {
      return { eligible: true, user };
    }

    return {
      eligible: false,
      reason: 'PREF_OFF',
      user,
    };
  }
}
