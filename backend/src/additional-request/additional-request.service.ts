import { Injectable } from '@nestjs/common';

@Injectable()
export class AdditionalRequestService {
  getStatus() {
    return { module: 'additional-request', status: 'ready' };
  }
}
