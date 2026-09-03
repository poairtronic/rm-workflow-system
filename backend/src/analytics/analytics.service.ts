import { Injectable } from '@nestjs/common';

@Injectable()
export class AnalyticsService {
  getStatus() {
    return { module: 'analytics', status: 'ready' };
  }
}
