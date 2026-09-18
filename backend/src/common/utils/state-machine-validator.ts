import { BadRequestException } from '@nestjs/common';
import { ScStatus } from '../../sc/entities/sc.entity.js';
import { RmRequestStatus } from '../../rm/entities/rm-request.entity.js';
import { ReturnStatus } from '../../production/entities/material-return.entity.js';
import { AdditionalRequestStatus } from '../../additional-request/entities/additional-request.entity.js';

export class StateMachineValidator {
  /**
   * Asserts that SC is open and active for business operations.
   */
  static assertScActive(status: ScStatus, actionName = 'operation'): void {
    if (status === ScStatus.COMPLETED) {
      throw new BadRequestException(
        `Cannot perform "${actionName}" on a COMPLETED / CLOSED Sales Order Component.`,
      );
    }
  }

  /**
   * Asserts that RM Request is in DRAFT state for modification.
   */
  static assertRmDraft(status: RmRequestStatus, actionName = 'modify RM'): void {
    if (status === RmRequestStatus.SUBMITTED) {
      throw new BadRequestException(
        `Cannot ${actionName} on an already SUBMITTED RM Request.`,
      );
    }
  }

  /**
   * Asserts that Material Return is in PENDING state for Stores verification.
   */
  static assertReturnPending(status: ReturnStatus): void {
    if (status === ReturnStatus.ACKNOWLEDGED) {
      throw new BadRequestException(
        `Material Return has already been VERIFIED / ACKNOWLEDGED. Duplicate verification blocked.`,
      );
    }
    if (status === ReturnStatus.REJECTED) {
      throw new BadRequestException(
        `Cannot verify a REJECTED Material Return.`,
      );
    }
  }

  /**
   * Asserts that Additional Material Request is in REQUESTED state before issue.
   */
  static assertAdditionalRequestPending(status: AdditionalRequestStatus): void {
    if (status === AdditionalRequestStatus.ISSUED) {
      throw new BadRequestException(
        `Additional Material Request has already been ISSUED. Duplicate issue blocked.`,
      );
    }
    if (status === AdditionalRequestStatus.CANCELLED || status === AdditionalRequestStatus.REJECTED) {
      throw new BadRequestException(
        `Cannot issue material for a ${status} Additional Request.`,
      );
    }
  }
}
