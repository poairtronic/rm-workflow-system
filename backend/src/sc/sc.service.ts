import { Injectable } from '@nestjs/common';

@Injectable()
export class ScService {
  getStatus() {
    return { module: 'sc', status: 'ready' };
  }
}
