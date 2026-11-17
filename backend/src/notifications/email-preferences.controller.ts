import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../auth/enums/role.enum.js';
import { EmailPreferencesService } from './email-preferences.service.js';
import {
  UpdateRoleEventSettingDto,
  BulkUpdateRoleEventsDto,
} from './dto/email-preferences-role.dto.js';
import {
  UpdateUserEventOverrideDto,
  BulkUpdateUserOverridesDto,
} from './dto/email-preferences-user.dto.js';
import { UpdateEmailPrefsModeDto } from './dto/email-preferences-mode.dto.js';
import { GetAuditQueryDto } from './dto/email-preferences-audit.dto.js';
import { GetEmailPreferencesUsersQueryDto } from './dto/email-preferences-users-query.dto.js';
import { UpdateSweepDto } from './dto/email-preferences-sweep.dto.js';
import {
  GetSkipsQueryDto,
  GetSkipsSummaryQueryDto,
} from './dto/email-preferences-skip.dto.js';

@Controller('api/email-preferences')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmailPreferencesController {
  constructor(
    private readonly emailPreferencesService: EmailPreferencesService,
  ) {}

  /**
   * Helper: Resolves acting user id from JWT payload.
   */
  private getActorUserId(req: any): string {
    return req.user?.userId || req.user?.sub || req.user?.id || 'UNKNOWN_ACTOR';
  }

  /**
   * 1. GET /events
   * Returns all configurable events (is_configurable = true only).
   */
  @Get('events')
  @Roles(UserRole.ADMIN, UserRole.GENERAL_MANAGER)
  async getEvents() {
    return await this.emailPreferencesService.getEvents();
  }

  /**
   * 2. GET /roles
   * Returns current mode, active roles, configurable events, and the complete role x event matrix.
   */
  @Get('roles')
  @Roles(UserRole.ADMIN, UserRole.GENERAL_MANAGER)
  async getRoleMatrix() {
    return await this.emailPreferencesService.getRoleMatrix();
  }

  /**
   * 3. PUT /roles/:roleId/events/:eventCode
   * Updates a single role-event setting.
   */
  @Put('roles/:roleId/events/:eventCode')
  @Roles(UserRole.ADMIN)
  async updateRoleEvent(
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Param('eventCode') eventCode: string,
    @Body() dto: UpdateRoleEventSettingDto,
    @Request() req: any,
  ) {
    const actorUserId = this.getActorUserId(req);
    return await this.emailPreferencesService.updateRoleEvent(
      roleId,
      eventCode,
      dto.enabled,
      actorUserId,
    );
  }

  /**
   * 4. PUT /roles/:roleId
   * Bulk updates multiple event settings for a role in one transaction.
   */
  @Put('roles/:roleId')
  @Roles(UserRole.ADMIN)
  async bulkUpdateRoleEvents(
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body() dto: BulkUpdateRoleEventsDto,
    @Request() req: any,
  ) {
    const actorUserId = this.getActorUserId(req);
    return await this.emailPreferencesService.bulkUpdateRoleEvents(
      roleId,
      dto.changes,
      actorUserId,
    );
  }

  /**
   * 5. GET /users?roleId=
   * Returns active users of the role with explicit override count.
   */
  @Get('users')
  @Roles(UserRole.ADMIN, UserRole.GENERAL_MANAGER)
  async getUsers(@Query() query: GetEmailPreferencesUsersQueryDto) {
    return await this.emailPreferencesService.getUsers(query.roleId);
  }

  /**
   * 6. GET /users/:userId
   * Returns user details, legacyEmailOff status, and effective preference evaluation for each event.
   */
  @Get('users/:userId')
  @Roles(UserRole.ADMIN, UserRole.GENERAL_MANAGER)
  async getUserPreferences(@Param('userId', ParseUUIDPipe) userId: string) {
    return await this.emailPreferencesService.getUserPreferences(userId);
  }

  /**
   * 7. PUT /users/:userId/events/:eventCode
   * Sets or removes ('INHERIT') a user override for a specific event.
   */
  @Put('users/:userId/events/:eventCode')
  @Roles(UserRole.ADMIN)
  async updateUserOverride(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('eventCode') eventCode: string,
    @Body() dto: UpdateUserEventOverrideDto,
    @Request() req: any,
  ) {
    const actorUserId = this.getActorUserId(req);
    return await this.emailPreferencesService.updateUserOverride(
      userId,
      eventCode,
      dto.state,
      actorUserId,
    );
  }

  /**
   * 8. PUT /users/:userId
   * Bulk updates multiple event overrides for a user in one transaction.
   */
  @Put('users/:userId')
  @Roles(UserRole.ADMIN)
  async bulkUpdateUserOverrides(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: BulkUpdateUserOverridesDto,
    @Request() req: any,
  ) {
    const actorUserId = this.getActorUserId(req);
    return await this.emailPreferencesService.bulkUpdateUserOverrides(
      userId,
      dto.changes,
      actorUserId,
    );
  }

  /**
   * 9. GET /audit?scope=ROLE|USER&targetId=&eventCode=&limit=&cursor=
   * Returns audit logs, newest first, with actor user display names.
   */
  @Get('audit')
  @Roles(UserRole.ADMIN, UserRole.GENERAL_MANAGER)
  async getAuditLogs(@Query() query: GetAuditQueryDto) {
    return await this.emailPreferencesService.getAuditLogs(query);
  }

  /**
   * 10. GET /mode
   * Returns the current system mode (OFF, SHADOW, ON).
   */
  @Get('mode')
  @Roles(UserRole.ADMIN, UserRole.GENERAL_MANAGER)
  async getMode() {
    return await this.emailPreferencesService.getMode();
  }

  /**
   * 10. PUT /mode
   * Updates EMAIL_PREFS_V2_MODE in system_settings. Admin only.
   */
  @Put('mode')
  @Roles(UserRole.ADMIN)
  async updateMode(
    @Body() dto: UpdateEmailPrefsModeDto,
    @Request() req: any,
  ) {
    const actorUserId = this.getActorUserId(req);
    return await this.emailPreferencesService.updateMode(dto.mode, actorUserId);
  }

  /**
   * 11. GET /sweeps
   * Returns status and thresholds for all 4 overdue alert sweeps.
   */
  @Get('sweeps')
  @Roles(UserRole.ADMIN, UserRole.GENERAL_MANAGER)
  async getSweeps() {
    return await this.emailPreferencesService.getSweeps();
  }

  /**
   * 12. PUT /sweeps/:eventCode
   * Updates enabled status and thresholdHours for a sweep. ADMIN only.
   */
  @Put('sweeps/:eventCode')
  @Roles(UserRole.ADMIN)
  async updateSweep(
    @Param('eventCode') eventCode: string,
    @Body() dto: UpdateSweepDto,
    @Request() req: any,
  ) {
    const actorUserId = this.getActorUserId(req);
    return await this.emailPreferencesService.updateSweep(eventCode, dto, actorUserId);
  }

  /**
   * 13. GET /sweeps/:eventCode/preview
   * Read-only preview of items matching sweep criteria.
   */
  @Get('sweeps/:eventCode/preview')
  @Roles(UserRole.ADMIN, UserRole.GENERAL_MANAGER)
  async previewSweep(@Param('eventCode') eventCode: string) {
    return await this.emailPreferencesService.previewSweep(eventCode);
  }

  /**
   * 14. GET /skips/summary
   * Returns summary counts by reason and event for the last N days.
   */
  @Get('skips/summary')
  @Roles(UserRole.ADMIN, UserRole.GENERAL_MANAGER)
  async getSkipsSummary(@Query() query: GetSkipsSummaryQueryDto) {
    return await this.emailPreferencesService.getSkipsSummary(query.days);
  }

  /**
   * 15. GET /skips
   * Returns list of skipped email logs with filters and cursor pagination.
   */
  @Get('skips')
  @Roles(UserRole.ADMIN, UserRole.GENERAL_MANAGER)
  async getSkips(@Query() query: GetSkipsQueryDto) {
    return await this.emailPreferencesService.getSkips(query);
  }
}
