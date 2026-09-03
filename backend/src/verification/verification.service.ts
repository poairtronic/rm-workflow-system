import { Injectable } from '@nestjs/common';

@Injectable()
export class VerificationService {
  getStatus() {
    return { module: 'verification', status: 'ready' };
  }
}
