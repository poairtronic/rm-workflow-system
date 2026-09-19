import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
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
      throw new ConflictException(`Customer with code ${createDto.code} already exists`);
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
      relations: { purchaseOrders: true }
    });
    if (!customer) {
      throw new NotFoundException(`Customer with id ${id} not found`);
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
        throw new ConflictException(`Customer with code ${updateDto.code} already exists`);
      }
    }

    Object.assign(customer, updateDto);
    return await this.customerRepository.save(customer);
  }
}
