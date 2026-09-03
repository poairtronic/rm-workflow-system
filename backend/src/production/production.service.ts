import { Injectable } from '@nestjs/common';

@Injectable()
export class ProductionService {
  getStatus() {
    return { module: 'production', status: 'ready' };
  }
}
