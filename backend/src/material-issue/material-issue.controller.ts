import { Controller, Get } from '@nestjs/common';
import { MaterialIssueService } from './material-issue.service.js';

@Controller('api/material-issue')
export class MaterialIssueController {
  constructor(private readonly materialIssueService: MaterialIssueService) {}

  @Get('status')
  getStatus() {
    return this.materialIssueService.getStatus();
  }
}
