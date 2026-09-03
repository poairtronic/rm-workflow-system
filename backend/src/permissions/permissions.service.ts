import { Injectable } from '@nestjs/common';

@Injectable()
export class PermissionsService {
  getStatus() {
    return { module: 'permissions', status: 'ready' };
  }
}
