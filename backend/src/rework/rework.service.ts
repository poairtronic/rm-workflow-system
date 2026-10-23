import { Injectable, NotFoundException, BadGatewayException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalesOrderComponent } from '../sc/entities/sc.entity.js';
import { PurchaseOrder } from '../po/entities/po.entity.js';
import { SubmitReworkDto } from './dto/submit-rework.dto.js';

export interface ReworkScItem {
  id: string;
  scNumber: string;
  productName: string;
  targetQuantity: number;
  status: string;
  poNumber: string;
  customerName: string;
  createdAt: Date;
}

@Injectable()
export class ReworkService {
  constructor(
    @InjectRepository(SalesOrderComponent)
    private readonly scRepo: Repository<SalesOrderComponent>,
    @InjectRepository(PurchaseOrder)
    private readonly poRepo: Repository<PurchaseOrder>,
  ) {}

  async getReworkScList(): Promise<ReworkScItem[]> {
    const results = await this.scRepo
      .createQueryBuilder('sc')
      .leftJoinAndSelect('sc.purchaseOrder', 'po')
      .leftJoinAndSelect('po.customer', 'customer')
      .orderBy('sc.createdAt', 'DESC')
      .getMany();

    return results.map((sc) => ({
      id: sc.id,
      scNumber: sc.scNumber,
      productName: sc.productName,
      targetQuantity: Number(sc.targetQuantity),
      status: sc.status,
      poNumber: sc.purchaseOrder?.poNumber ?? '',
      customerName: (sc.purchaseOrder as any)?.customer?.name ?? '',
      createdAt: sc.createdAt,
    }));
  }

  async submitToEcr(dto: SubmitReworkDto, userName: string): Promise<{ reportId: string; reportNumber: string }> {
    const sc = await this.scRepo.findOne({
      where: { id: dto.scId },
      relations: { purchaseOrder: true },
    });

    if (!sc) {
      throw new NotFoundException(`SC with id ${dto.scId} not found`);
    }

    const payload = {
      type: dto.type,
      scNumber: sc.scNumber,
      poNumber: sc.purchaseOrder?.poNumber ?? '',
      component: dto.component || sc.productName,
      quantityAffected: dto.quantityAffected
        ? Math.round(Number(dto.quantityAffected))
        : Math.round(Number(sc.targetQuantity)) || 1,
      stageOfFailure: dto.stageOfFailure || dto.rejectionFailedStage || 'General',
      errorType: dto.errorType,
      defectDescription: dto.defectDescription,
      responsibleParty: dto.responsibleParty,
      operatorName: dto.operatorName,
      reworkDescription: dto.reworkDescription,
      rejectionDescription: dto.rejectionDescription,
      rejectionProcessTemplate: dto.rejectionProcessTemplate,
      rejectionFailedStage: dto.rejectionFailedStage,
      rejectionStageCosts: dto.rejectionStageCosts,
      costEstimation: dto.costEstimation,
      lossEstimation: dto.lossEstimation,
      alternativeNotes: dto.alternativeNotes,
      raisedByName: userName,
    };

    const rawEcrUrl = (process.env.ECR_API_URL || '').replace(/\/+$/, '');
    const ecrBaseUrl = rawEcrUrl.endsWith('/api') ? rawEcrUrl : `${rawEcrUrl}/api`;
    const ecrSecret = process.env.ECR_INTERNAL_SECRET;

    const res = await fetch(`${ecrBaseUrl}/internal/rm-intake`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': ecrSecret || '',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new BadGatewayException(`ECR rejected the report: ${errText}`);
    }

    return res.json() as Promise<{ reportId: string; reportNumber: string }>;
  }
}
