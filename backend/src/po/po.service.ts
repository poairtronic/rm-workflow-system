import {
  Injectable,
  NotFoundException,
  ConflictException,
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
      relations: { customer: true },
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
}
