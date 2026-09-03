import { Injectable } from '@nestjs/common';

@Injectable()
export class RmService {
  getStatus() {
    return { module: 'rm', status: 'ready' };
  }
}
