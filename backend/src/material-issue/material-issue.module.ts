import { Module } from '@nestjs/common';
import { MaterialIssueController } from './material-issue.controller.js';
import { MaterialIssueService } from './material-issue.service.js';

@Module({
  controllers: [MaterialIssueController],
  providers: [MaterialIssueService],
  exports: [MaterialIssueService],
})
export class MaterialIssueModule {}
