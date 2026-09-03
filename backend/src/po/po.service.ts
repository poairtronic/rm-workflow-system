import { Injectable } from '@nestjs/common';

@Injectable()
export class PoService {
  getStatus() {
    return { module: 'po', status: 'ready' };
  }
}
