import { Injectable } from '@nestjs/common';

@Injectable()
export class CustomersService {
  getStatus() {
    return { module: 'customers', status: 'ready' };
  }
}
