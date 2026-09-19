const fs = require('fs');

let poCode = import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
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
      where: { poNumber: createDto.poNumber }
    });
    if (existing) {
      throw new ConflictException(\Purchase Order with number \ already exists\);
    }

    const customer = await this.customerRepository.findOne({
      where: { id: createDto.customerId }
    });
    if (!customer) {
      throw new NotFoundException(\Customer with id \ not found\);
    }

    const po = this.poRepository.create(createDto);
    return await this.poRepository.save(po);
  }

  async findAll() {
    return await this.poRepository.find({
      relations: ['customer'],
      order: { createdAt: 'DESC' }
    });
  }

  async findOne(id: string) {
    const po = await this.poRepository.findOne({
      where: { id },
      relations: ['customer', 'salesOrderComponents']
    });
    if (!po) {
      throw new NotFoundException(\Purchase Order with id \ not found\);
    }
    return po;
  }

  async update(id: string, updateDto: UpdatePoDto) {
    const po = await this.findOne(id);

    if (updateDto.poNumber && updateDto.poNumber !== po.poNumber) {
      const existing = await this.poRepository.findOne({
        where: { poNumber: updateDto.poNumber }
      });
      if (existing) {
        throw new ConflictException(\Purchase Order with number \ already exists\);
      }
    }

    if (updateDto.customerId && updateDto.customerId !== po.customerId) {
      const customer = await this.customerRepository.findOne({
        where: { id: updateDto.customerId }
      });
      if (!customer) {
        throw new NotFoundException(\Customer with id \ not found\);
      }
    }

    Object.assign(po, updateDto);
    return await this.poRepository.save(po);
  }
};

fs.writeFileSync('backend/src/po/po.service.ts', poCode);

let custCode = import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from './entities/customer.entity.js';
import { CreateCustomerDto } from './dto/create-customer.dto.js';
import { UpdateCustomerDto } from './dto/update-customer.dto.js';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
  ) {}

  getStatus() {
    return { module: 'customers', status: 'ready' };
  }

  async create(createDto: CreateCustomerDto) {
    const existing = await this.customerRepository.findOne({
      where: { code: createDto.code }
    });
    if (existing) {
      throw new ConflictException(\Customer with code \ already exists\);
    }

    const customer = this.customerRepository.create(createDto);
    return await this.customerRepository.save(customer);
  }

  async findAll() {
    return await this.customerRepository.find({
      order: { name: 'ASC' }
    });
  }

  async findOne(id: string) {
    const customer = await this.customerRepository.findOne({
      where: { id },
      relations: ['purchaseOrders']
    });
    if (!customer) {
      throw new NotFoundException(\Customer with id \ not found\);
    }
    return customer;
  }

  async update(id: string, updateDto: UpdateCustomerDto) {
    const customer = await this.findOne(id);
    
    if (updateDto.code && updateDto.code !== customer.code) {
      const existing = await this.customerRepository.findOne({
        where: { code: updateDto.code }
      });
      if (existing) {
        throw new ConflictException(\Customer with code \ already exists\);
      }
    }

    Object.assign(customer, updateDto);
    return await this.customerRepository.save(customer);
  }
};

fs.writeFileSync('backend/src/customers/customers.service.ts', custCode);
