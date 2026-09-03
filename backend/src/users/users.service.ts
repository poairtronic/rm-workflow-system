import { Injectable } from '@nestjs/common';

@Injectable()
export class UsersService {
  getStatus() {
    return { module: 'users', status: 'ready' };
  }
}
