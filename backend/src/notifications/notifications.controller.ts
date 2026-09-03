import { Controller, Get } from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';

@Controller('api/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('status')
  getStatus() {
    return this.notificationsService.getStatus();
  }
}
