import { Controller, Get, UseGuards } from '@nestjs/common';
import { MaterialIssueService } from './material-issue.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@Controller('api/material-issue')
export class MaterialIssueController {
  constructor(private readonly materialIssueService: MaterialIssueService) {}

  @Get('status')
  getStatus() {
    return this.materialIssueService.getStatus();
  }
}
