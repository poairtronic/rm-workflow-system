import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { NotificationEvent } from './entities/notification-event.entity.js';
import { RoleEmailSetting } from './entities/role-email-setting.entity.js';
import { UserEmailOverride } from './entities/user-email-override.entity.js';
import { EmailSettingAudit } from './entities/email-setting-audit.entity.js';
import { SystemSetting } from './entities/system-setting.entity.js';
import { UserNotificationPreference } from './entities/user-notification-preference.entity.js';
import { Role } from '../roles/entities/role.entity.js';
import { User } from '../users/entities/user.entity.js';
import {
  NotificationPreferenceService,
  EMAIL_PREFS_V2_MODE_KEY,
  EmailPrefsMode,
} from './notification-preference.service.js';
import { evaluateUserPreference } from './user-preference-decision.js';
import { RoleEventChangeItemDto } from './dto/email-preferences-role.dto.js';
import {
  UserOverrideChangeItemDto,
  UserOverrideState,
} from './dto/email-preferences-user.dto.js';
import { GetAuditQueryDto } from './dto/email-preferences-audit.dto.js';
import { UpdateSweepDto } from './dto/email-preferences-sweep.dto.js';
import {
  GetSkipsQueryDto,
  SkipsResponseDto,
  SkipsSummaryResponseDto,
} from './dto/email-preferences-skip.dto.js';
import { AlertSweepService, SWEEP_CONFIGS } from '../alert-sweeps/alert-sweeps.service.js';
import { EmailSkipLogService } from './email-skip-log.service.js';

const DISALLOWED_EVENT_CODES = new Set(['PASSWORD_RESET', 'TEST_EMAIL']);

@Injectable()
export class EmailPreferencesService {
  private readonly logger = new Logger(EmailPreferencesService.name);

  constructor(
    @InjectRepository(NotificationEvent)
    private readonly notificationEventRepository: Repository<NotificationEvent>,
    @InjectRepository(RoleEmailSetting)
    private readonly roleEmailSettingRepository: Repository<RoleEmailSetting>,
    @InjectRepository(UserEmailOverride)
    private readonly userEmailOverrideRepository: Repository<UserEmailOverride>,
    @InjectRepository(EmailSettingAudit)
    private readonly emailSettingAuditRepository: Repository<EmailSettingAudit>,
    @InjectRepository(SystemSetting)
    private readonly systemSettingRepository: Repository<SystemSetting>,
    @InjectRepository(UserNotificationPreference)
    private readonly userPrefRepository: Repository<UserNotificationPreference>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly notificationPreferenceService: NotificationPreferenceService,
    private readonly dataSource: DataSource,
    @Optional()
    @Inject(forwardRef(() => AlertSweepService))
    private readonly alertSweepService?: AlertSweepService,
    @Optional()
    private readonly emailSkipLogService?: EmailSkipLogService,
  ) {}

  /**
   * Helper: Validates that an eventCode is registered and configurable.
   * Explicitly rejects security/diagnostic codes (PASSWORD_RESET, TEST_EMAIL) and unknown codes.
   */
  private async validateConfigurableEvent(eventCode: string): Promise<NotificationEvent> {
    if (!eventCode || DISALLOWED_EVENT_CODES.has(eventCode.trim().toUpperCase())) {
      throw new BadRequestException(
        `Event "${eventCode}" is not configurable via Email Preferences.`,
      );
    }

    const event = await this.notificationEventRepository.findOne({
      where: { code: eventCode.trim(), isConfigurable: true },
    });

    if (!event) {
      throw new BadRequestException(
        `Event "${eventCode}" is invalid, unregistered, or marked non-configurable.`,
      );
    }

    return event;
  }

  /**
   * 1. GET /events
   * Returns list of configurable events: code, label, category.
   */
  async getEvents(): Promise<Array<{ code: string; label: string; category: string }>> {
    const events = await this.notificationEventRepository.find({
      where: { isConfigurable: true },
      order: { category: 'ASC', code: 'ASC' },
    });
    return events.map((e) => ({
      code: e.code,
      label: e.label,
      category: e.category,
    }));
  }

  /**
   * 2. GET /roles
   * Returns: { mode, roles: [{id, name}], events: [...], matrix: { [roleId]: { [eventCode]: boolean } } }
   */
  async getRoleMatrix(): Promise<{
    mode: EmailPrefsMode;
    roles: Array<{ id: string; name: string }>;
    events: Array<{ code: string; label: string; category: string }>;
    matrix: Record<string, Record<string, boolean>>;
  }> {
    const [mode, roles, events, settings] = await Promise.all([
      this.notificationPreferenceService.getMode(),
      this.roleRepository.find({
        where: {
          name: In([
            'ADMIN',
            'DESIGNER',
            'STORES',
            'PRODUCTION',
            'SENIOR_MANAGER',
            'GENERAL_MANAGER',
          ]),
        },
        order: { name: 'ASC' },
      }),
      this.getEvents(),
      this.roleEmailSettingRepository.find(),
    ]);

    const matrix: Record<string, Record<string, boolean>> = {};
    for (const r of roles) {
      matrix[r.id] = {};
      for (const e of events) {
        matrix[r.id][e.code] = false;
      }
    }

    for (const s of settings) {
      if (matrix[s.roleId] && matrix[s.roleId][s.eventCode] !== undefined) {
        matrix[s.roleId][s.eventCode] = s.enabled;
      }
    }

    return {
      mode,
      roles: roles.map((r) => ({ id: r.id, name: r.name })),
      events,
      matrix,
    };
  }

  /**
   * 3. PUT /roles/:roleId/events/:eventCode
   * Updates a single role-event toggle.
   * If value is identical to current, no-op (no writes, no audit).
   */
  async updateRoleEvent(
    roleId: string,
    eventCode: string,
    enabled: boolean,
    actorUserId: string,
  ): Promise<{
    success: boolean;
    roleId: string;
    eventCode: string;
    enabled: boolean;
    mode: EmailPrefsMode;
  }> {
    const role = await this.roleRepository.findOne({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException(`Role with id "${roleId}" not found.`);
    }

    await this.validateConfigurableEvent(eventCode);

    const mode = await this.notificationPreferenceService.getMode();

    await this.dataSource.transaction(async (manager) => {
      const settingRepo = manager.getRepository(RoleEmailSetting);
      const auditRepo = manager.getRepository(EmailSettingAudit);

      const current = await settingRepo.findOne({
        where: { roleId, eventCode },
      });

      const currentEnabled = current ? current.enabled : false;
      if (currentEnabled === enabled) {
        // No-op: new value matches current value. Write nothing, no audit row.
        return;
      }

      if (current) {
        current.enabled = enabled;
        current.updatedBy = actorUserId;
        current.updatedAt = new Date();
        await settingRepo.save(current);
      } else {
        await settingRepo.save(
          settingRepo.create({
            roleId,
            eventCode,
            enabled,
            updatedBy: actorUserId,
          }),
        );
      }

      // Write audit record in the same transaction
      await auditRepo.save(
        auditRepo.create({
          scope: 'ROLE',
          targetId: roleId,
          eventCode,
          oldValue: currentEnabled ? 'ON' : 'OFF',
          newValue: enabled ? 'ON' : 'OFF',
          changedBy: actorUserId,
        }),
      );
    });

    return { success: true, roleId, eventCode, enabled, mode };
  }

  /**
   * 4. PUT /roles/:roleId
   * Bulk updates multiple event toggles for a role in one transaction (all-or-nothing).
   */
  async bulkUpdateRoleEvents(
    roleId: string,
    changes: RoleEventChangeItemDto[],
    actorUserId: string,
  ): Promise<{
    success: boolean;
    roleId: string;
    updatedCount: number;
    mode: EmailPrefsMode;
  }> {
    const role = await this.roleRepository.findOne({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException(`Role with id "${roleId}" not found.`);
    }

    if (!changes || changes.length === 0) {
      const mode = await this.notificationPreferenceService.getMode();
      return { success: true, roleId, updatedCount: 0, mode };
    }

    // Pre-validate all events prior to opening transaction
    for (const change of changes) {
      await this.validateConfigurableEvent(change.eventCode);
    }

    const mode = await this.notificationPreferenceService.getMode();
    let updatedCount = 0;

    await this.dataSource.transaction(async (manager) => {
      const settingRepo = manager.getRepository(RoleEmailSetting);
      const auditRepo = manager.getRepository(EmailSettingAudit);

      const existingSettings = await settingRepo.find({ where: { roleId } });
      const currentMap = new Map<string, RoleEmailSetting>();
      for (const s of existingSettings) {
        currentMap.set(s.eventCode, s);
      }

      for (const change of changes) {
        const current = currentMap.get(change.eventCode);
        const currentEnabled = current ? current.enabled : false;

        if (currentEnabled === change.enabled) {
          continue; // No-op for this item
        }

        if (current) {
          current.enabled = change.enabled;
          current.updatedBy = actorUserId;
          current.updatedAt = new Date();
          await settingRepo.save(current);
        } else {
          const created = await settingRepo.save(
            settingRepo.create({
              roleId,
              eventCode: change.eventCode,
              enabled: change.enabled,
              updatedBy: actorUserId,
            }),
          );
          currentMap.set(change.eventCode, created);
        }

        await auditRepo.save(
          auditRepo.create({
            scope: 'ROLE',
            targetId: roleId,
            eventCode: change.eventCode,
            oldValue: currentEnabled ? 'ON' : 'OFF',
            newValue: change.enabled ? 'ON' : 'OFF',
            changedBy: actorUserId,
          }),
        );
        updatedCount++;
      }
    });

    return { success: true, roleId, updatedCount, mode };
  }

  /**
   * 5. GET /users?roleId=
   * Returns active users of the role (id, name, email, role), with explicit override count.
   */
  async getUsers(roleId?: string): Promise<
    Array<{
      id: string;
      name: string;
      email: string;
      department?: string;
      role: { id: string; name: string };
      overrideCount: number;
    }>
  > {
    if (roleId) {
      const roleExists = await this.roleRepository.findOne({ where: { id: roleId } });
      if (!roleExists) {
        throw new NotFoundException(`Role with id "${roleId}" not found.`);
      }
    }

    const users = await this.userRepository.find({
      where: {
        isActive: true,
        ...(roleId ? { roleId } : {}),
      },
      relations: { role: true },
      order: { name: 'ASC' },
    });

    if (users.length === 0) {
      return [];
    }

    const userIds = users.map((u) => u.id);
    const overrideCounts = await this.userEmailOverrideRepository
      .createQueryBuilder('o')
      .select('o.user_id', 'userId')
      .addSelect('COUNT(*)', 'count')
      .where('o.user_id IN (:...userIds)', { userIds })
      .groupBy('o.user_id')
      .getRawMany();

    const countMap = new Map<string, number>();
    for (const row of overrideCounts) {
      countMap.set(row.userId, parseInt(row.count, 10) || 0);
    }

    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      department: u.department,
      role: { id: u.role.id, name: u.role.name },
      overrideCount: countMap.get(u.id) || 0,
    }));
  }

  /**
   * 6. GET /users/:userId
   * Returns comprehensive user notification status and resolved event matrix.
   */
  async getUserPreferences(userId: string): Promise<{
    mode: EmailPrefsMode;
    user: {
      id: string;
      name: string;
      email: string;
      department?: string;
      role: { id: string; name: string };
      isActive: boolean;
    };
    legacyEmailOff: boolean;
    events: Array<{
      code: string;
      label: string;
      category: string;
      override: UserOverrideState;
      roleEnabled: boolean;
      effective: boolean;
      source: string;
    }>;
  }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: { role: true },
    });

    if (!user) {
      throw new NotFoundException(`User with id "${userId}" not found.`);
    }

    if (!user.isActive) {
      throw new BadRequestException(`User "${userId}" is inactive.`);
    }

    const [mode, legacyPref, events, roleSettings, userOverrides] = await Promise.all([
      this.notificationPreferenceService.getMode(),
      this.userPrefRepository.findOne({ where: { userId } }),
      this.getEvents(),
      this.roleEmailSettingRepository.find({ where: { roleId: user.roleId } }),
      this.userEmailOverrideRepository.find({ where: { userId } }),
    ]);

    const legacyEmailOff = legacyPref ? !legacyPref.workflowEmailEnabled : false;

    const roleSettingsMap = new Map<string, boolean>();
    for (const rs of roleSettings) {
      roleSettingsMap.set(rs.eventCode, rs.enabled);
    }

    const overrideMap = new Map<string, 'ON' | 'OFF'>();
    for (const ov of userOverrides) {
      overrideMap.set(ov.eventCode, ov.state as 'ON' | 'OFF');
    }

    const mappedEvents = events.map((event) => {
      const overrideState: UserOverrideState = overrideMap.get(event.code) || 'INHERIT';
      const roleEnabled = roleSettingsMap.get(event.code) === true;

      const decision = evaluateUserPreference({
        overrideState,
        legacyEmailOff,
        roleEnabled,
      });

      return {
        code: event.code,
        label: event.label,
        category: event.category,
        override: overrideState,
        roleEnabled,
        effective: decision.effective,
        source: decision.source,
      };
    });

    return {
      mode,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        department: user.department,
        role: { id: user.role.id, name: user.role.name },
        isActive: user.isActive,
      },
      legacyEmailOff,
      events: mappedEvents,
    };
  }

  /**
   * 7. PUT /users/:userId/events/:eventCode
   * Updates or deletes (INHERIT) a user override for a specific event.
   */
  async updateUserOverride(
    userId: string,
    eventCode: string,
    state: UserOverrideState,
    actorUserId: string,
  ): Promise<{
    success: boolean;
    userId: string;
    eventCode: string;
    state: UserOverrideState;
    mode: EmailPrefsMode;
  }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with id "${userId}" not found.`);
    }

    if (!user.isActive) {
      throw new BadRequestException(`Cannot modify email preferences for inactive user "${userId}".`);
    }

    await this.validateConfigurableEvent(eventCode);
    const mode = await this.notificationPreferenceService.getMode();

    await this.dataSource.transaction(async (manager) => {
      const overrideRepo = manager.getRepository(UserEmailOverride);
      const auditRepo = manager.getRepository(EmailSettingAudit);

      const current = await overrideRepo.findOne({
        where: { userId, eventCode },
      });

      const currentState: UserOverrideState = current ? (current.state as UserOverrideState) : 'INHERIT';
      if (currentState === state) {
        // No-op
        return;
      }

      if (state === 'INHERIT') {
        if (current) {
          await overrideRepo.delete({ id: current.id });
        }
      } else {
        if (current) {
          current.state = state;
          current.updatedBy = actorUserId;
          current.updatedAt = new Date();
          await overrideRepo.save(current);
        } else {
          await overrideRepo.save(
            overrideRepo.create({
              userId,
              eventCode,
              state,
              updatedBy: actorUserId,
            }),
          );
        }
      }

      await auditRepo.save(
        auditRepo.create({
          scope: 'USER',
          targetId: userId,
          eventCode,
          oldValue: currentState,
          newValue: state,
          changedBy: actorUserId,
        }),
      );
    });

    return { success: true, userId, eventCode, state, mode };
  }

  /**
   * 8. PUT /users/:userId
   * Bulk updates multiple event overrides for a user in one transaction (all-or-nothing).
   */
  async bulkUpdateUserOverrides(
    userId: string,
    changes: UserOverrideChangeItemDto[],
    actorUserId: string,
  ): Promise<{
    success: boolean;
    userId: string;
    updatedCount: number;
    mode: EmailPrefsMode;
  }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with id "${userId}" not found.`);
    }

    if (!user.isActive) {
      throw new BadRequestException(`Cannot modify email preferences for inactive user "${userId}".`);
    }

    if (!changes || changes.length === 0) {
      const mode = await this.notificationPreferenceService.getMode();
      return { success: true, userId, updatedCount: 0, mode };
    }

    for (const change of changes) {
      await this.validateConfigurableEvent(change.eventCode);
    }

    const mode = await this.notificationPreferenceService.getMode();
    let updatedCount = 0;

    await this.dataSource.transaction(async (manager) => {
      const overrideRepo = manager.getRepository(UserEmailOverride);
      const auditRepo = manager.getRepository(EmailSettingAudit);

      const existingOverrides = await overrideRepo.find({ where: { userId } });
      const currentMap = new Map<string, UserEmailOverride>();
      for (const ov of existingOverrides) {
        currentMap.set(ov.eventCode, ov);
      }

      for (const change of changes) {
        const current = currentMap.get(change.eventCode);
        const currentState: UserOverrideState = current
          ? (current.state as UserOverrideState)
          : 'INHERIT';

        if (currentState === change.state) {
          continue; // No-op
        }

        if (change.state === 'INHERIT') {
          if (current) {
            await overrideRepo.delete({ id: current.id });
            currentMap.delete(change.eventCode);
          }
        } else {
          if (current) {
            current.state = change.state;
            current.updatedBy = actorUserId;
            current.updatedAt = new Date();
            await overrideRepo.save(current);
          } else {
            const created = await overrideRepo.save(
              overrideRepo.create({
                userId,
                eventCode: change.eventCode,
                state: change.state,
                updatedBy: actorUserId,
              }),
            );
            currentMap.set(change.eventCode, created);
          }
        }

        await auditRepo.save(
          auditRepo.create({
            scope: 'USER',
            targetId: userId,
            eventCode: change.eventCode,
            oldValue: currentState,
            newValue: change.state,
            changedBy: actorUserId,
          }),
        );
        updatedCount++;
      }
    });

    return { success: true, userId, updatedCount, mode };
  }

  /**
   * 9. GET /audit?scope=ROLE|USER&targetId=&eventCode=&limit=&cursor=
   * Returns audit logs, newest first, with actor user's display name.
   */
  async getAuditLogs(query: GetAuditQueryDto): Promise<{
    entries: Array<{
      id: string;
      scope: string;
      targetId: string;
      eventCode: string;
      oldValue?: string | null;
      newValue: string;
      changedBy: string;
      changedByName: string;
      changedAt: Date;
    }>;
    nextCursor: string | null;
  }> {
    const limit = Math.min(Math.max(query.limit || 50, 1), 100);

    const qb = this.emailSettingAuditRepository.createQueryBuilder('a');

    if (query.scope) {
      qb.andWhere('a.scope = :scope', { scope: query.scope });
    }
    if (query.targetId) {
      qb.andWhere('a.targetId = :targetId', { targetId: query.targetId });
    }
    if (query.eventCode) {
      qb.andWhere('a.eventCode = :eventCode', { eventCode: query.eventCode });
    }
    if (query.cursor) {
      const cursorDate = new Date(query.cursor);
      if (!isNaN(cursorDate.getTime())) {
        qb.andWhere('a.changedAt < :cursorDate', { cursorDate });
      }
    }

    qb.orderBy('a.changedAt', 'DESC').addOrderBy('a.id', 'DESC');
    qb.take(limit + 1);

    const items = await qb.getMany();
    const hasMore = items.length > limit;
    const entriesToReturn = hasMore ? items.slice(0, limit) : items;

    // Resolve user names for changedBy
    const changedByIds = Array.from(new Set(entriesToReturn.map((e) => e.changedBy).filter(Boolean)));
    const userNameMap = new Map<string, string>();
    if (changedByIds.length > 0) {
      const users = await this.userRepository.find({
        where: { id: In(changedByIds) },
        select: { id: true, name: true },
      });
      for (const u of users) {
        userNameMap.set(u.id, u.name);
      }
    }

    const nextCursor =
      hasMore && entriesToReturn.length > 0
        ? entriesToReturn[entriesToReturn.length - 1].changedAt.toISOString()
        : null;

    return {
      entries: entriesToReturn.map((e) => ({
        id: e.id,
        scope: e.scope,
        targetId: e.targetId,
        eventCode: e.eventCode,
        oldValue: e.oldValue,
        newValue: e.newValue,
        changedBy: e.changedBy,
        changedByName: userNameMap.get(e.changedBy) || e.changedBy,
        changedAt: e.changedAt,
      })),
      nextCursor,
    };
  }

  /**
   * 10. GET /mode
   * Returns current system mode.
   */
  async getMode(): Promise<{ mode: EmailPrefsMode }> {
    const mode = await this.notificationPreferenceService.getMode();
    return { mode };
  }

  /**
   * 10. PUT /mode
   * Updates EMAIL_PREFS_V2_MODE in system_settings and invalidates in-memory cache.
   */
  async updateMode(
    mode: EmailPrefsMode,
    actorUserId: string,
  ): Promise<{ success: boolean; mode: EmailPrefsMode }> {
    if (mode !== 'OFF' && mode !== 'SHADOW' && mode !== 'ON') {
      throw new BadRequestException('Mode must be one of: OFF, SHADOW, ON');
    }

    let existing = await this.systemSettingRepository.findOne({
      where: { key: EMAIL_PREFS_V2_MODE_KEY },
    });

    const oldMode = existing ? existing.value : 'OFF';

    if (existing) {
      existing.value = mode;
      existing.updatedBy = actorUserId;
      existing.updatedAt = new Date();
      await this.systemSettingRepository.save(existing);
    } else {
      await this.systemSettingRepository.save(
        this.systemSettingRepository.create({
          key: EMAIL_PREFS_V2_MODE_KEY,
          value: mode,
          updatedBy: actorUserId,
        }),
      );
    }

    // Invalidate 30s in-memory cache so change takes effect immediately
    this.notificationPreferenceService.clearModeCache();

    this.logger.log(
      `[EmailPreferencesService] EMAIL_PREFS_V2_MODE updated from "${oldMode}" to "${mode}" by user "${actorUserId}"`,
    );

    return { success: true, mode };
  }

  /**
   * 11. GET /sweeps
   * Returns list of all 4 overdue alert sweeps with current status and thresholds.
   */
  async getSweeps(): Promise<Array<{
    eventCode: string;
    label: string;
    category: string;
    enabled: boolean;
    thresholdHours: number;
    defaultHours: number;
    switchKey: string;
    thresholdKey: string;
  }>> {
    if (!this.alertSweepService) {
      throw new BadRequestException('AlertSweepService is not available.');
    }
    return await this.alertSweepService.getAllSweepConfigs();
  }

  /**
   * 12. PUT /sweeps/:eventCode
   * Updates enabled status and thresholdHours for one of the 4 overdue alert sweeps.
   */
  async updateSweep(
    eventCode: string,
    dto: UpdateSweepDto,
    actorUserId: string,
  ): Promise<{
    eventCode: string;
    enabled: boolean;
    thresholdHours: number;
    mode: EmailPrefsMode;
  }> {
    if (!eventCode || !SWEEP_CONFIGS[eventCode]) {
      throw new BadRequestException(
        `Invalid sweep eventCode "${eventCode}". Must be one of: ${Object.keys(SWEEP_CONFIGS).join(', ')}`,
      );
    }

    if (dto.thresholdHours === undefined || dto.thresholdHours < 1 || dto.thresholdHours > 720) {
      throw new BadRequestException('thresholdHours must be an integer between 1 and 720.');
    }

    if (!this.alertSweepService) {
      throw new BadRequestException('AlertSweepService is not available.');
    }

    const updated = await this.alertSweepService.updateSweepConfig(
      eventCode,
      dto.enabled,
      dto.thresholdHours,
      actorUserId,
    );

    const mode = await this.notificationPreferenceService.getMode();
    return { ...updated, mode };
  }

  /**
   * 13. GET /sweeps/:eventCode/preview
   * Returns read-only preview of items currently matching the sweep threshold.
   */
  async previewSweep(eventCode: string): Promise<{
    eventCode: string;
    matchCount: number;
    sample: any[];
    notYetTimedCount?: number;
    mode: EmailPrefsMode;
  }> {
    if (!eventCode || !SWEEP_CONFIGS[eventCode]) {
      throw new BadRequestException(
        `Invalid sweep eventCode "${eventCode}". Must be one of: ${Object.keys(SWEEP_CONFIGS).join(', ')}`,
      );
    }

    if (!this.alertSweepService) {
      throw new BadRequestException('AlertSweepService is not available.');
    }

    const preview = await this.alertSweepService.previewSweep(eventCode);
    const mode = await this.notificationPreferenceService.getMode();

    return {
      eventCode,
      ...preview,
      mode,
    };
  }

  /**
   * 14. GET /skips
   * Returns list of skipped email logs with filters and cursor pagination.
   */
  async getSkips(filters: GetSkipsQueryDto): Promise<SkipsResponseDto> {
    if (!this.emailSkipLogService) {
      throw new BadRequestException('EmailSkipLogService is not available.');
    }
    return this.emailSkipLogService.list(filters);
  }

  /**
   * 15. GET /skips/summary
   * Returns summary counts by reason and event for the last N days.
   */
  async getSkipsSummary(days: number = 7): Promise<SkipsSummaryResponseDto> {
    if (!this.emailSkipLogService) {
      throw new BadRequestException('EmailSkipLogService is not available.');
    }
    return this.emailSkipLogService.summary(days);
  }
}
