import { Injectable } from '@nestjs/common';

@Injectable()
export class StoresService {
  getStatus() {
    return { module: 'stores', status: 'ready' };
  }
}
