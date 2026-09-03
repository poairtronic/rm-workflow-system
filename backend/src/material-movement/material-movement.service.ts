import { Injectable } from '@nestjs/common';

@Injectable()
export class MaterialMovementService {
  getStatus() {
    return { module: 'material-movement', status: 'ready' };
  }
}
