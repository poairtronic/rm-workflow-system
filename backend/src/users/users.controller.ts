import { Controller, Get } from '@nestjs/common';
import { UsersService } from './users.service.js';

@Controller('api/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('status')
  getStatus() {
    return this.usersService.getStatus();
  }
}
