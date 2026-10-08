import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalesOrderComponent } from '../sc/entities/sc.entity.js';
import { RmItem } from '../rm/entities/rm-item.entity.js';
import { MaterialConsumption } from '../production/entities/material-consumption.entity.js';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(SalesOrderComponent)
    private scRepo: Repository<SalesOrderComponent>,
    @InjectRepository(RmItem)
    private rmItemRepo: Repository<RmItem>,
    @InjectRepository(MaterialConsumption)
    private consumptionRepo: Repository<MaterialConsumption>,
  ) {}

  async getProcessWiseReport() {
    const data = await this.scRepo.find({
      relations: {
        purchaseOrder: true,
        materialIssues: true,
        materialConsumptions: true
      },
      order: { createdAt: 'DESC' }
    });
    
    return data.map(sc => ({
      scNumber: sc.scNumber,
      poNumber: sc.purchaseOrder?.poNumber || 'N/A',
      productName: sc.productName,
      status: sc.status,
      targetQuantity: Number(sc.targetQuantity),
      createdAt: sc.createdAt,
      completedAt: sc.completedAt
    }));
  }

  async getItemWiseReport() {
    const data = await this.rmItemRepo.find({
      relations: {
        salesOrderComponent: true
      },
      order: { createdAt: 'DESC' }
    });

    return data.map(item => ({
      itemId: item.id,
      material: item.material,
      grade: item.grade,
      quantity: Number(item.quantity),
      unit: item.weightUnit, // using weightUnit instead of unit
      scNumber: item.salesOrderComponent?.scNumber || 'N/A',
      createdAt: item.createdAt
    }));
  }

  async getRmConsumptionReport() {
    const data = await this.consumptionRepo.find({
      relations: {
        salesOrderComponent: true,
        recordedBy: true,
        rmItem: true
      },
      order: { recordedAt: 'DESC' }
    });

    return data.map(c => ({
      consumptionId: c.id,
      scNumber: c.salesOrderComponent?.scNumber || 'N/A',
      material: c.rmItem?.material || 'Unknown',
      quantityConsumed: Number(c.consumedQuantity),
      consumptionDate: c.recordedAt,
      consumedBy: c.recordedBy?.name || 'Unknown'
    }));
  }
}

