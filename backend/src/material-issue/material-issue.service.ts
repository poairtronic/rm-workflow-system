import { Injectable } from '@nestjs/common';

@Injectable()
export class MaterialIssueService {
  getStatus() {
    return { module: 'material-issue', status: 'ready' };
  }
}
