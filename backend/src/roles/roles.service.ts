import { Injectable } from '@nestjs/common';

@Injectable()
export class RolesService {
  getStatus() {
    return { module: 'roles', status: 'ready' };
  }
}
