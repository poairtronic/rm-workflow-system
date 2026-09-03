import { Injectable } from '@nestjs/common';

@Injectable()
export class AuditService {
  getStatus() {
    return { module: 'audit', status: 'ready' };
  }
}
