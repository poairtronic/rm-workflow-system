import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PurchaseOrder } from './entities/po.entity.js';
import { CreatePoDto } from './dto/create-po.dto.js';
import { UpdatePoDto } from './dto/update-po.dto.js';
import { Customer } from '../customers/entities/customer.entity.js';

@Injectable()
export class PoService {
  constructor(
    @InjectRepository(PurchaseOrder)
    private readonly poRepository: Repository<PurchaseOrder>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
  ) {}

  getStatus() {
    return { module: 'po', status: 'ready' };
  }

  async create(createDto: CreatePoDto) {
    const existing = await this.poRepository.findOne({
      where: { poNumber: createDto.poNumber },
    });
    if (existing) {
      throw new ConflictException(
        `Purchase Order with number ${createDto.poNumber} already exists`,
      );
    }

    const customer = await this.customerRepository.findOne({
      where: { id: createDto.customerId },
    });
    if (!customer) {
      throw new NotFoundException(
        `Customer with id ${createDto.customerId} not found`,
      );
    }

    const po = this.poRepository.create(createDto);
    return await this.poRepository.save(po);
  }

  async findAll() {
    return await this.poRepository.find({
      relations: { customer: true, salesOrderComponents: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const po = await this.poRepository.findOne({
      where: { id },
      relations: { customer: true, salesOrderComponents: true },
    });
    if (!po) {
      throw new NotFoundException(`Purchase Order with id ${id} not found`);
    }
    return po;
  }

  async update(id: string, updateDto: UpdatePoDto) {
    const po = await this.findOne(id);

    if (updateDto.poNumber && updateDto.poNumber !== po.poNumber) {
      const existing = await this.poRepository.findOne({
        where: { poNumber: updateDto.poNumber },
      });
      if (existing) {
        throw new ConflictException(
          `Purchase Order with number ${updateDto.poNumber} already exists`,
        );
      }
    }

    if (updateDto.customerId && updateDto.customerId !== po.customerId) {
      const customer = await this.customerRepository.findOne({
        where: { id: updateDto.customerId },
      });
      if (!customer) {
        throw new NotFoundException(
          `Customer with id ${updateDto.customerId} not found`,
        );
      }
    }

    Object.assign(po, updateDto);
    return await this.poRepository.save(po);
  }

  async delete(id: string, user: any) {
    const po = await this.poRepository.findOne({
      where: { id },
      relations: { salesOrderComponents: true },
    });

    if (!po) {
      throw new NotFoundException(`Purchase Order with ID "${id}" not found.`);
    }

    const dataSource = this.poRepository.manager.connection;
    const scList = po.salesOrderComponents || [];
    const scIds = scList.map((sc) => sc.id);

    // 1. Check if any associated SC has active material issues, delivery challans, or consumptions
    if (scIds.length > 0) {
      const hasMaterialIssues = await dataSource.query(
        `SELECT 1 FROM material_issues WHERE sc_id = ANY($1) LIMIT 1`,
        [scIds],
      );
      if (hasMaterialIssues.length > 0) {
        throw new BadRequestException(
          `Cannot delete Purchase Order "${po.poNumber}" because materials have already been issued for its components.`,
        );
      }

      const hasDcs =
        (await dataSource.query(`SELECT 1 FROM delivery_challans WHERE sc_id = ANY($1) LIMIT 1`, [scIds])).length > 0 ||
        (await dataSource.query(`SELECT 1 FROM delivery_challan_items WHERE sc_id = ANY($1) LIMIT 1`, [scIds])).length > 0;
      if (hasDcs) {
        throw new BadRequestException(
          `Cannot delete Purchase Order "${po.poNumber}" because delivery challans exist for its components.`,
        );
      }

      const hasConsumptions = await dataSource.query(
        `SELECT 1 FROM material_consumptions WHERE sc_id = ANY($1) LIMIT 1`,
        [scIds],
      );
      if (hasConsumptions.length > 0) {
        throw new BadRequestException(
          `Cannot delete Purchase Order "${po.poNumber}" because production consumption records exist for its components.`,
        );
      }
    }

    // 2. Cascade delete in transaction
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Find all RM request IDs under this PO or its SCs
      let rmIds: string[] = [];
      const rmRows = await queryRunner.query(
        `SELECT id FROM rm_requests WHERE po_id = $1 ${scIds.length > 0 ? 'OR sc_id = ANY($2)' : ''}`,
        scIds.length > 0 ? [id, scIds] : [id],
      );
      rmIds = rmRows.map((r: any) => r.id);

      if (rmIds.length > 0) {
        await queryRunner.query(`DELETE FROM rm_item_snapshots WHERE rm_form_id = ANY($1)`, [rmIds]);
        await queryRunner.query(
          `DELETE FROM rm_form_sc WHERE rm_form_id = ANY($1) ${scIds.length > 0 ? 'OR sc_id = ANY($2)' : ''}`,
          scIds.length > 0 ? [rmIds, scIds] : [rmIds],
        );
        await queryRunner.query(
          `DELETE FROM rm_items WHERE rm_form_id = ANY($1) ${scIds.length > 0 ? 'OR sc_id = ANY($2)' : ''}`,
          scIds.length > 0 ? [rmIds, scIds] : [rmIds],
        );
        await queryRunner.query(`DELETE FROM rm_requests WHERE id = ANY($1)`, [rmIds]);
      }

      if (scIds.length > 0) {
        await queryRunner.query(`DELETE FROM rm_form_sc WHERE sc_id = ANY($1)`, [scIds]);
        await queryRunner.query(`DELETE FROM rm_items WHERE sc_id = ANY($1)`, [scIds]);
        await queryRunner.query(`DELETE FROM additional_material_requests WHERE sc_id = ANY($1)`, [scIds]);
        await queryRunner.query(
          `DELETE FROM attachments WHERE record_id = ANY($1) AND context IN ('SC', 'SC_DOCUMENT', 'RM_REQUEST')`,
          [scIds],
        );
        await queryRunner.query(`DELETE FROM sales_order_components WHERE id = ANY($1)`, [scIds]);
      }

      // Delete PO attachments
      await queryRunner.query(
        `DELETE FROM attachments WHERE record_id = $1 AND context = 'PO'`,
        [id],
      );

      // Finally delete the PO record
      await queryRunner.query(`DELETE FROM purchase_orders WHERE id = $1`, [id]);

      await queryRunner.commitTransaction();
      return {
        success: true,
        message: `Purchase Order ${po.poNumber} and associated unissued components deleted successfully.`,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
