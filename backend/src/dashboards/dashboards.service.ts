import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not } from 'typeorm';
import { RmRequest, RmRequestStatus } from '../rm/entities/rm-request.entity.js';
import { SalesOrderComponent, ScStatus } from '../sc/entities/sc.entity.js';
import { MaterialIssue } from '../material-issue/entities/material-issue.entity.js';
import { AdditionalMaterialRequest, AdditionalRequestStatus } from '../additional-request/entities/additional-request.entity.js';

@Injectable()
export class DashboardsService {
  constructor(
    @InjectRepository(RmRequest)
    private rmRequestRepo: Repository<RmRequest>,
    @InjectRepository(SalesOrderComponent)
    private scRepo: Repository<SalesOrderComponent>,
    @InjectRepository(MaterialIssue)
    private issueRepo: Repository<MaterialIssue>,
    @InjectRepository(AdditionalMaterialRequest)
    private additionalRequestRepo: Repository<AdditionalMaterialRequest>,
  ) {}

  async getDesignerDashboard(userId: string) {
    const activeDrafts = await this.rmRequestRepo.count({
      where: { status: RmRequestStatus.DRAFT, createdById: userId },
    });
    const submittedRms = await this.rmRequestRepo.count({
      where: { status: RmRequestStatus.SUBMITTED, createdById: userId },
    });
    
    const totalSCAssociated = await this.scRepo.count({
      where: { status: Not(ScStatus.CLOSED) }
    });

    return {
      activeDrafts,
      submittedRms,
      totalSCAssociated
    };
  }

  async getStoresDashboard() {
    const pendingRmRequests = await this.rmRequestRepo.count({
      where: { status: RmRequestStatus.SUBMITTED },
    });
    const pendingAdditionalRequests = await this.additionalRequestRepo.count({
      where: { status: AdditionalRequestStatus.REQUESTED }
    });
    const approvedAdditionalToIssue = await this.additionalRequestRepo.count({
      where: { status: AdditionalRequestStatus.APPROVED }
    });

    return {
      pendingRmRequests,
      pendingAdditionalRequests,
      approvedAdditionalToIssue,
    };
  }

  async getProductionDashboard() {
    // Issues that are partially received or waiting to be received are tracked by SC status PARTIALLY_ISSUED / ISSUED
    const pendingReceipts = await this.scRepo.count({
      where: { status: In([ScStatus.ISSUED, ScStatus.PARTIALLY_ISSUED]) }
    });
    const activeBatches = await this.scRepo.count({
      where: { status: ScStatus.IN_PRODUCTION }
    });
    const additionalRequested = await this.additionalRequestRepo.count({
      where: { status: AdditionalRequestStatus.REQUESTED }
    });

    return {
      pendingReceipts,
      activeBatches,
      additionalRequested
    };
  }

  async getManagementDashboard() {
    const totalActiveScs = await this.scRepo.count({
      where: { status: Not(In([ScStatus.COMPLETED, ScStatus.CLOSED])) }
    });
    const totalCompletedScs = await this.scRepo.count({
      where: { status: ScStatus.COMPLETED }
    });
    const totalClosedScs = await this.scRepo.count({
      where: { status: ScStatus.CLOSED }
    });
    const totalExceptions = await this.additionalRequestRepo.count({
      where: { status: Not(In([AdditionalRequestStatus.CANCELLED, AdditionalRequestStatus.REJECTED])) }
    });

    return {
      totalActiveScs,
      totalCompletedScs,
      totalClosedScs,
      totalExceptions
    };
  }
}

