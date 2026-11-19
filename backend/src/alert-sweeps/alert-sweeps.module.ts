import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailAlertWatch } from './entities/email-alert-watch.entity.js';
import { AlertSweepService } from './alert-sweeps.service.js';
import { SystemSetting } from '../notifications/entities/system-setting.entity.js';
import { DeliveryChallan } from '../delivery-challan/entities/delivery-challan.entity.js';
import { DeliveryChallanItem } from '../delivery-challan/entities/delivery-challan-item.entity.js';
import { ConsumableRequest } from '../consumables/entities/consumable-request.entity.js';
import { ConsumableRequestItem } from '../consumables/entities/consumable-request-item.entity.js';
import { RmRequest } from '../rm/entities/rm-request.entity.js';
import { MaterialIssue } from '../material-issue/entities/material-issue.entity.js';
import { MercIndentPending } from '../merc-indent/entities/merc-indent-pending.entity.js';
import { EcrMaterialPending } from '../ecr-issues/entities/ecr-material-pending.entity.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { EmailModule } from '../email/email.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EmailAlertWatch,
      SystemSetting,
      DeliveryChallan,
      DeliveryChallanItem,
      ConsumableRequest,
      ConsumableRequestItem,
      RmRequest,
      MaterialIssue,
      MercIndentPending,
      EcrMaterialPending,
    ]),
    forwardRef(() => NotificationsModule),
    forwardRef(() => EmailModule),
  ],
  providers: [AlertSweepService],
  exports: [AlertSweepService],
})
export class AlertSweepModule {}
