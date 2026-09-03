import { Injectable } from '@nestjs/common';

@Injectable()
export class NotificationsService {
  getStatus() {
    return { module: 'notifications', status: 'ready' };
  }
}
