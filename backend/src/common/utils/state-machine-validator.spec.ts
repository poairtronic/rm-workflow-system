import { describe, it, expect } from 'vitest';
import { StateMachineValidator } from './state-machine-validator.js';
import { ScStatus } from '../../sc/entities/sc.entity.js';
import { RmRequestStatus } from '../../rm/entities/rm-request.entity.js';
import { ReturnStatus } from '../../production/entities/material-return.entity.js';
import { AdditionalRequestStatus } from '../../additional-request/entities/additional-request.entity.js';
import { BadRequestException } from '@nestjs/common';

describe('StateMachineValidator', () => {
  it('should allow active SC and block completed SC', () => {
    expect(() => StateMachineValidator.assertScActive(ScStatus.IN_PRODUCTION, 'Issue')).not.toThrow();
    expect(() => StateMachineValidator.assertScActive(ScStatus.COMPLETED, 'Issue')).toThrow(BadRequestException);
  });

  it('should allow draft RM and block submitted RM modifications', () => {
    expect(() => StateMachineValidator.assertRmDraft(RmRequestStatus.DRAFT, 'add item')).not.toThrow();
    expect(() => StateMachineValidator.assertRmDraft(RmRequestStatus.SUBMITTED, 'add item')).toThrow(BadRequestException);
  });

  it('should allow pending return verification and block duplicate verification', () => {
    expect(() => StateMachineValidator.assertReturnPending(ReturnStatus.PENDING_STORE_ACK)).not.toThrow();
    expect(() => StateMachineValidator.assertReturnPending(ReturnStatus.ACKNOWLEDGED)).toThrow(BadRequestException);
  });

  it('should allow pending additional request and block re-issuance', () => {
    expect(() => StateMachineValidator.assertAdditionalRequestPending(AdditionalRequestStatus.REQUESTED)).not.toThrow();
    expect(() => StateMachineValidator.assertAdditionalRequestPending(AdditionalRequestStatus.ISSUED)).toThrow(BadRequestException);
  });
});
