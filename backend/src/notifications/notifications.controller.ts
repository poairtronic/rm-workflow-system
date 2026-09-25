import {
  Controller,
  Get,
  Patch,
  Body,
  Query,
  UseGuards,
  Request,
  Param,
  ForbiddenException,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../auth/enums/role.enum.js';
import { UpdateGlobalPreferenceDto } from './dto/update-global-preference.dto.js';
import { UpdateUserPreferenceDto } from './dto/update-user-preference.dto.js';
import { GetNotificationsQueryDto } from './dto/get-notifications-query.dto.js';

@Controller('api/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('status')
  getStatus() {
    return this.notificationsService.getStatus();
  }

  @Get('unread-count')
  @UseGuards(JwtAuthGuard)
  async getUnreadCount(@Request() req: any) {
    const userId = req.user?.userId || req.user?.sub || req.user?.id;
    const count = await this.notificationsService.getUnreadCount(userId);
    return { unreadCount: count };
  }

  @Patch('read-all')
  @UseGuards(JwtAuthGuard)
  async markAllAsRead(@Request() req: any) {
    const userId = req.user?.userId || req.user?.sub || req.user?.id;
    return await this.notificationsService.markAllAsRead(userId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getMyNotifications(
    @Request() req: any,
    @Query() query: GetNotificationsQueryDto,
  ) {
    const userId = req.user?.userId || req.user?.sub || req.user?.id;
    if (query?.userId && query.userId !== userId) {
      throw new ForbiddenException('Cannot query notifications of another user');
    }
    return await this.notificationsService.getUserNotificationsPaginated(
      userId,
      query,
    );
  }

  @Patch(':id/read')
  @UseGuards(JwtAuthGuard)
  async markAsRead(@Request() req: any, @Param('id', new ParseUUIDPipe()) notificationId: string) {
    const userId = req.user?.userId || req.user?.sub || req.user?.id;
    return await this.notificationsService.markNotificationAsRead(
      userId,
      notificationId,
    );
  }

  @Get('settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getGlobalSettings() {
    const enabled = await this.notificationsService.getGlobalWorkflowEmailEnabled();
    return { workflowEmailEnabled: enabled };
  }

  @Patch('settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async updateGlobalSettings(
    @Body() dto: UpdateGlobalPreferenceDto,
    @Request() req: any,
  ) {
    if (typeof dto.workflowEmailEnabled !== 'boolean') {
      throw new BadRequestException('workflowEmailEnabled must be a boolean');
    }
    const enabled = await this.notificationsService.setGlobalWorkflowEmailEnabled(
      dto.workflowEmailEnabled,
      req.user?.userId || req.user?.email || 'ADMIN',
    );
    return { workflowEmailEnabled: enabled };
  }

  @Get('preferences/me')
  @UseGuards(JwtAuthGuard)
  async getMyPreferences(@Request() req: any) {
    const userId = req.user.userId;
    const enabled = await this.notificationsService.getUserWorkflowEmailEnabled(userId);
    return { workflowEmailEnabled: enabled };
  }

  @Patch('preferences/me')
  @UseGuards(JwtAuthGuard)
  async updateMyPreferences(
    @Request() req: any,
    @Body() dto: UpdateUserPreferenceDto,
  ) {
    if (typeof dto.workflowEmailEnabled !== 'boolean') {
      throw new BadRequestException('workflowEmailEnabled must be a boolean');
    }
    const userId = req.user.userId;
    const updated = await this.notificationsService.setUserWorkflowEmailEnabled(
      userId,
      dto.workflowEmailEnabled,
    );
    return { workflowEmailEnabled: updated.workflowEmailEnabled };
  }

  @Patch('preferences/:userId')
  @UseGuards(JwtAuthGuard)
  async updateUserPreferencesById(
    @Request() req: any,
    @Param('userId') targetUserId: string,
    @Body() dto: UpdateUserPreferenceDto,
  ) {
    if (req.user.userId !== targetUserId) {
      throw new ForbiddenException(
        'Cannot update notification preferences of another user',
      );
    }
    if (typeof dto.workflowEmailEnabled !== 'boolean') {
      throw new BadRequestException('workflowEmailEnabled must be a boolean');
    }
    const updated = await this.notificationsService.setUserWorkflowEmailEnabled(
      targetUserId,
      dto.workflowEmailEnabled,
    );
    return { workflowEmailEnabled: updated.workflowEmailEnabled };
  }
}
