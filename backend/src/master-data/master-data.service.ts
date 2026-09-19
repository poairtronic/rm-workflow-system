import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductCategory } from '../inventory/entities/product-category.entity.js';
import { ProductFamily } from '../inventory/entities/product-family.entity.js';
import { Product } from '../inventory/entities/product.entity.js';
import { Warehouse } from '../inventory/entities/warehouse.entity.js';
import { WarehouseLocation } from '../inventory/entities/warehouse-location.entity.js';
import { Rack } from '../inventory/entities/rack.entity.js';
import { Bin } from '../inventory/entities/bin.entity.js';

import {
  CreateCategoryDto,
  UpdateCategoryDto,
} from './dto/category.dto.js';
import {
  CreateFamilyDto,
  UpdateFamilyDto,
} from './dto/family.dto.js';
import {
  CreateProductDto,
  UpdateProductDto,
} from './dto/product.dto.js';
import {
  CreateWarehouseDto,
  UpdateWarehouseDto,
} from './dto/warehouse.dto.js';
import {
  CreateLocationDto,
  UpdateLocationDto,
} from './dto/location.dto.js';
import {
  CreateRackDto,
  UpdateRackDto,
} from './dto/rack.dto.js';
import {
  CreateBinDto,
  UpdateBinDto,
} from './dto/bin.dto.js';
import { MasterFilterDto } from './dto/master-filter.dto.js';

@Injectable()
export class MasterDataService {
  constructor(
    @InjectRepository(ProductCategory)
    private readonly categoryRepo: Repository<ProductCategory>,
    @InjectRepository(ProductFamily)
    private readonly familyRepo: Repository<ProductFamily>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepo: Repository<Warehouse>,
    @InjectRepository(WarehouseLocation)
    private readonly locationRepo: Repository<WarehouseLocation>,
    @InjectRepository(Rack)
    private readonly rackRepo: Repository<Rack>,
    @InjectRepository(Bin)
    private readonly binRepo: Repository<Bin>,
  ) {}

  // ==========================================
  // 1. PRODUCT CATEGORIES
  // ==========================================
  async createCategory(dto: CreateCategoryDto) {
    const trimmedName = dto.name?.trim();
    if (!trimmedName) {
      throw new BadRequestException('Category name cannot be empty.');
    }
    const existing = await this.categoryRepo
      .createQueryBuilder('c')
      .where('LOWER(c.name) = LOWER(:name)', { name: trimmedName })
      .getOne();

    if (existing) {
      throw new ConflictException(`Category with name "${trimmedName}" already exists.`);
    }

    const category = this.categoryRepo.create({
      name: trimmedName,
      isActive: dto.isActive ?? true,
    });
    return this.categoryRepo.save(category);
  }

  async findCategories(filter: MasterFilterDto) {
    const { search, isActive, page = 1, pageSize = 20 } = filter;
    const qb = this.categoryRepo.createQueryBuilder('c');

    if (search) {
      qb.andWhere('c.name ILIKE :search', { search: `%${search}%` });
    }
    if (isActive !== undefined) {
      qb.andWhere('c.isActive = :isActive', { isActive });
    }

    qb.orderBy('c.name', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findCategoryById(id: string) {
    const category = await this.categoryRepo.findOne({
      where: { id },
      relations: { families: true },
    });
    if (!category) {
      throw new NotFoundException(`Category with ID "${id}" not found.`);
    }
    return category;
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const category = await this.findCategoryById(id);

    if (dto.name !== undefined) {
      const trimmedName = dto.name.trim();
      if (!trimmedName) {
        throw new BadRequestException('Category name cannot be empty.');
      }
      const existing = await this.categoryRepo
        .createQueryBuilder('c')
        .where('LOWER(c.name) = LOWER(:name)', { name: trimmedName })
        .andWhere('c.id != :id', { id })
        .getOne();

      if (existing) {
        throw new ConflictException(`Category with name "${trimmedName}" already exists.`);
      }
      category.name = trimmedName;
    }

    if (dto.isActive !== undefined) {
      category.isActive = dto.isActive;
    }

    return this.categoryRepo.save(category);
  }

  async deleteCategory(id: string) {
    const category = await this.findCategoryById(id);
    const familyCount = await this.familyRepo.count({
      where: { categoryId: id },
    });

    if (familyCount > 0) {
      throw new ConflictException(
        `Cannot delete category "${category.name}" because it contains ${familyCount} product families. Deactivate it instead.`,
      );
    }

    await this.categoryRepo.remove(category);
    return { success: true, message: `Category "${category.name}" deleted successfully.` };
  }

  // ==========================================
  // 2. PRODUCT FAMILIES
  // ==========================================
  async createFamily(dto: CreateFamilyDto) {
    const category = await this.categoryRepo.findOneBy({ id: dto.categoryId });
    if (!category) {
      throw new NotFoundException(`Parent Category with ID "${dto.categoryId}" not found.`);
    }

    const trimmedName = dto.name.trim();
    const existing = await this.familyRepo
      .createQueryBuilder('f')
      .where('f.categoryId = :categoryId', { categoryId: dto.categoryId })
      .andWhere('LOWER(f.name) = LOWER(:name)', { name: trimmedName })
      .getOne();

    if (existing) {
      throw new ConflictException(
        `Family with name "${trimmedName}" already exists under this Category.`,
      );
    }

    const family = this.familyRepo.create({
      categoryId: dto.categoryId,
      name: trimmedName,
      isActive: dto.isActive ?? true,
    });
    return this.familyRepo.save(family);
  }

  async findFamilies(filter: MasterFilterDto) {
    const { search, isActive, parentId, page = 1, pageSize = 20 } = filter;
    const qb = this.familyRepo
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.category', 'category');

    if (parentId) {
      qb.andWhere('f.categoryId = :parentId', { parentId });
    }
    if (search) {
      qb.andWhere('f.name ILIKE :search', { search: `%${search}%` });
    }
    if (isActive !== undefined) {
      qb.andWhere('f.isActive = :isActive', { isActive });
    }

    qb.orderBy('f.name', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findFamilyById(id: string) {
    const family = await this.familyRepo.findOne({
      where: { id },
      relations: { category: true, products: true },
    });
    if (!family) {
      throw new NotFoundException(`Family with ID "${id}" not found.`);
    }
    return family;
  }

  async updateFamily(id: string, dto: UpdateFamilyDto) {
    const family = await this.findFamilyById(id);

    const targetCategoryId = dto.categoryId ?? family.categoryId;
    if (dto.categoryId !== undefined) {
      const category = await this.categoryRepo.findOneBy({ id: dto.categoryId });
      if (!category) {
        throw new NotFoundException(`Parent Category with ID "${dto.categoryId}" not found.`);
      }
      family.categoryId = dto.categoryId;
    }

    if (dto.name !== undefined) {
      const trimmedName = dto.name.trim();
      const existing = await this.familyRepo
        .createQueryBuilder('f')
        .where('f.categoryId = :categoryId', { categoryId: targetCategoryId })
        .andWhere('LOWER(f.name) = LOWER(:name)', { name: trimmedName })
        .andWhere('f.id != :id', { id })
        .getOne();

      if (existing) {
        throw new ConflictException(
          `Family with name "${trimmedName}" already exists under this Category.`,
        );
      }
      family.name = trimmedName;
    }

    if (dto.isActive !== undefined) {
      family.isActive = dto.isActive;
    }

    return this.familyRepo.save(family);
  }

  // ==========================================
  // 3. PRODUCTS
  // ==========================================
  async createProduct(dto: CreateProductDto) {
    const family = await this.familyRepo.findOneBy({ id: dto.familyId });
    if (!family) {
      throw new NotFoundException(`Parent Family with ID "${dto.familyId}" not found.`);
    }

    const min = dto.minimumInventory ?? 0;
    const max = dto.maximumInventory;
    if (max !== undefined && max < min) {
      throw new BadRequestException(
        `maximumInventory (${max}) cannot be less than minimumInventory (${min}).`,
      );
    }

    const trimmedName = dto.name.trim();
    const existing = await this.productRepo
      .createQueryBuilder('p')
      .where('LOWER(p.name) = LOWER(:name)', { name: trimmedName })
      .getOne();

    if (existing) {
      throw new ConflictException(`Product with name "${trimmedName}" already exists.`);
    }

    const product = this.productRepo.create({
      familyId: dto.familyId,
      name: trimmedName,
      minimumInventory: min,
      maximumInventory: max,
      isActive: dto.isActive ?? true,
    });

    // NOTE: Product creation MUST NOT create any StockBalance rows!
    return this.productRepo.save(product);
  }

  async findProducts(filter: MasterFilterDto) {
    const { search, isActive, parentId, page = 1, pageSize = 20 } = filter;
    const qb = this.productRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.family', 'family')
      .leftJoinAndSelect('family.category', 'category');

    if (parentId) {
      qb.andWhere('p.familyId = :parentId', { parentId });
    }
    if (search) {
      qb.andWhere('p.name ILIKE :search', { search: `%${search}%` });
    }
    if (isActive !== undefined) {
      qb.andWhere('p.isActive = :isActive', { isActive });
    }

    qb.orderBy('p.name', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findProductById(id: string) {
    const product = await this.productRepo.findOne({
      where: { id },
      relations: { family: { category: true } },
    });
    if (!product) {
      throw new NotFoundException(`Product with ID "${id}" not found.`);
    }
    return product;
  }

  async updateProduct(id: string, dto: UpdateProductDto) {
    const product = await this.findProductById(id);

    if (dto.familyId !== undefined) {
      const family = await this.familyRepo.findOneBy({ id: dto.familyId });
      if (!family) {
        throw new NotFoundException(`Parent Family with ID "${dto.familyId}" not found.`);
      }
      product.familyId = dto.familyId;
    }

    if (dto.name !== undefined) {
      const trimmedName = dto.name.trim();
      const existing = await this.productRepo
        .createQueryBuilder('p')
        .where('LOWER(p.name) = LOWER(:name)', { name: trimmedName })
        .andWhere('p.id != :id', { id })
        .getOne();

      if (existing) {
        throw new ConflictException(`Product with name "${trimmedName}" already exists.`);
      }
      product.name = trimmedName;
    }

    const min = dto.minimumInventory ?? product.minimumInventory;
    const max = dto.maximumInventory !== undefined ? dto.maximumInventory : product.maximumInventory;
    if (max !== undefined && max !== null && max < min) {
      throw new BadRequestException(
        `maximumInventory (${max}) cannot be less than minimumInventory (${min}).`,
      );
    }

    if (dto.minimumInventory !== undefined) product.minimumInventory = dto.minimumInventory;
    if (dto.maximumInventory !== undefined) product.maximumInventory = dto.maximumInventory;
    if (dto.isActive !== undefined) product.isActive = dto.isActive;

    return this.productRepo.save(product);
  }

  // ==========================================
  // 4. WAREHOUSES
  // ==========================================
  async createWarehouse(dto: CreateWarehouseDto) {
    const normalizedCode = dto.code.trim().toUpperCase();
    const trimmedName = dto.name.trim();

    const existingCode = await this.warehouseRepo
      .createQueryBuilder('w')
      .where('UPPER(w.code) = :code', { code: normalizedCode })
      .getOne();

    if (existingCode) {
      throw new ConflictException(`Warehouse code "${normalizedCode}" already exists.`);
    }

    const existingName = await this.warehouseRepo
      .createQueryBuilder('w')
      .where('LOWER(w.name) = LOWER(:name)', { name: trimmedName })
      .getOne();

    if (existingName) {
      throw new ConflictException(`Warehouse name "${trimmedName}" already exists.`);
    }

    const warehouse = this.warehouseRepo.create({
      code: normalizedCode,
      name: trimmedName,
      isActive: dto.isActive ?? true,
    });
    return this.warehouseRepo.save(warehouse);
  }

  async findWarehouses(filter: MasterFilterDto) {
    const { search, isActive, page = 1, pageSize = 20 } = filter;
    const qb = this.warehouseRepo.createQueryBuilder('w');

    if (search) {
      qb.andWhere('(w.name ILIKE :search OR w.code ILIKE :search)', { search: `%${search}%` });
    }
    if (isActive !== undefined) {
      qb.andWhere('w.isActive = :isActive', { isActive });
    }

    qb.orderBy('w.code', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findWarehouseById(id: string) {
    const warehouse = await this.warehouseRepo.findOne({
      where: { id },
      relations: { locations: true },
    });
    if (!warehouse) {
      throw new NotFoundException(`Warehouse with ID "${id}" not found.`);
    }
    return warehouse;
  }

  async updateWarehouse(id: string, dto: UpdateWarehouseDto) {
    const warehouse = await this.findWarehouseById(id);

    if (dto.code !== undefined) {
      const normalizedCode = dto.code.trim().toUpperCase();
      const existing = await this.warehouseRepo
        .createQueryBuilder('w')
        .where('UPPER(w.code) = :code', { code: normalizedCode })
        .andWhere('w.id != :id', { id })
        .getOne();

      if (existing) {
        throw new ConflictException(`Warehouse code "${normalizedCode}" already exists.`);
      }
      warehouse.code = normalizedCode;
    }

    if (dto.name !== undefined) {
      const trimmedName = dto.name.trim();
      const existing = await this.warehouseRepo
        .createQueryBuilder('w')
        .where('LOWER(w.name) = LOWER(:name)', { name: trimmedName })
        .andWhere('w.id != :id', { id })
        .getOne();

      if (existing) {
        throw new ConflictException(`Warehouse name "${trimmedName}" already exists.`);
      }
      warehouse.name = trimmedName;
    }

    if (dto.isActive !== undefined) {
      warehouse.isActive = dto.isActive;
    }

    return this.warehouseRepo.save(warehouse);
  }

  // ==========================================
  // 5. WAREHOUSE LOCATIONS
  // ==========================================
  async createLocation(dto: CreateLocationDto) {
    const warehouse = await this.warehouseRepo.findOneBy({ id: dto.warehouseId });
    if (!warehouse) {
      throw new NotFoundException(`Parent Warehouse with ID "${dto.warehouseId}" not found.`);
    }

    const normalizedCode = dto.code.trim().toUpperCase();
    const trimmedName = dto.name.trim();

    const existingCode = await this.locationRepo
      .createQueryBuilder('l')
      .where('l.warehouseId = :warehouseId', { warehouseId: dto.warehouseId })
      .andWhere('UPPER(l.code) = :code', { code: normalizedCode })
      .getOne();

    if (existingCode) {
      throw new ConflictException(
        `Location code "${normalizedCode}" already exists in this Warehouse.`,
      );
    }

    const location = this.locationRepo.create({
      warehouseId: dto.warehouseId,
      code: normalizedCode,
      name: trimmedName,
      isActive: dto.isActive ?? true,
    });
    return this.locationRepo.save(location);
  }

  async findLocations(filter: MasterFilterDto) {
    const { search, isActive, parentId, page = 1, pageSize = 20 } = filter;
    const qb = this.locationRepo
      .createQueryBuilder('l')
      .leftJoinAndSelect('l.warehouse', 'warehouse');

    if (parentId) {
      qb.andWhere('l.warehouseId = :parentId', { parentId });
    }
    if (search) {
      qb.andWhere('(l.name ILIKE :search OR l.code ILIKE :search)', { search: `%${search}%` });
    }
    if (isActive !== undefined) {
      qb.andWhere('l.isActive = :isActive', { isActive });
    }

    qb.orderBy('l.code', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findLocationById(id: string) {
    const location = await this.locationRepo.findOne({
      where: { id },
      relations: { warehouse: true, racks: true },
    });
    if (!location) {
      throw new NotFoundException(`Location with ID "${id}" not found.`);
    }
    return location;
  }

  async updateLocation(id: string, dto: UpdateLocationDto) {
    const location = await this.findLocationById(id);

    const targetWarehouseId = dto.warehouseId ?? location.warehouseId;
    if (dto.warehouseId !== undefined) {
      const warehouse = await this.warehouseRepo.findOneBy({ id: dto.warehouseId });
      if (!warehouse) {
        throw new NotFoundException(`Parent Warehouse with ID "${dto.warehouseId}" not found.`);
      }
      location.warehouseId = dto.warehouseId;
    }

    if (dto.code !== undefined) {
      const normalizedCode = dto.code.trim().toUpperCase();
      const existing = await this.locationRepo
        .createQueryBuilder('l')
        .where('l.warehouseId = :warehouseId', { warehouseId: targetWarehouseId })
        .andWhere('UPPER(l.code) = :code', { code: normalizedCode })
        .andWhere('l.id != :id', { id })
        .getOne();

      if (existing) {
        throw new ConflictException(
          `Location code "${normalizedCode}" already exists in this Warehouse.`,
        );
      }
      location.code = normalizedCode;
    }

    if (dto.name !== undefined) {
      location.name = dto.name.trim();
    }
    if (dto.isActive !== undefined) {
      location.isActive = dto.isActive;
    }

    return this.locationRepo.save(location);
  }

  // ==========================================
  // 6. RACKS
  // ==========================================
  async createRack(dto: CreateRackDto) {
    const location = await this.locationRepo.findOneBy({ id: dto.locationId });
    if (!location) {
      throw new NotFoundException(`Parent Location with ID "${dto.locationId}" not found.`);
    }

    const normalizedCode = dto.code.trim().toUpperCase();
    const trimmedName = dto.name.trim();

    const existingCode = await this.rackRepo
      .createQueryBuilder('r')
      .where('r.locationId = :locationId', { locationId: dto.locationId })
      .andWhere('UPPER(r.code) = :code', { code: normalizedCode })
      .getOne();

    if (existingCode) {
      throw new ConflictException(
        `Rack code "${normalizedCode}" already exists in this Location.`,
      );
    }

    const rack = this.rackRepo.create({
      locationId: dto.locationId,
      code: normalizedCode,
      name: trimmedName,
      isActive: dto.isActive ?? true,
    });
    return this.rackRepo.save(rack);
  }

  async findRacks(filter: MasterFilterDto) {
    const { search, isActive, parentId, page = 1, pageSize = 20 } = filter;
    const qb = this.rackRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.location', 'location')
      .leftJoinAndSelect('location.warehouse', 'warehouse');

    if (parentId) {
      qb.andWhere('r.locationId = :parentId', { parentId });
    }
    if (search) {
      qb.andWhere('(r.name ILIKE :search OR r.code ILIKE :search)', { search: `%${search}%` });
    }
    if (isActive !== undefined) {
      qb.andWhere('r.isActive = :isActive', { isActive });
    }

    qb.orderBy('r.code', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findRackById(id: string) {
    const rack = await this.rackRepo.findOne({
      where: { id },
      relations: { location: { warehouse: true }, bins: true },
    });
    if (!rack) {
      throw new NotFoundException(`Rack with ID "${id}" not found.`);
    }
    return rack;
  }

  async updateRack(id: string, dto: UpdateRackDto) {
    const rack = await this.findRackById(id);

    const targetLocationId = dto.locationId ?? rack.locationId;
    if (dto.locationId !== undefined) {
      const location = await this.locationRepo.findOneBy({ id: dto.locationId });
      if (!location) {
        throw new NotFoundException(`Parent Location with ID "${dto.locationId}" not found.`);
      }
      rack.locationId = dto.locationId;
    }

    if (dto.code !== undefined) {
      const normalizedCode = dto.code.trim().toUpperCase();
      const existing = await this.rackRepo
        .createQueryBuilder('r')
        .where('r.locationId = :locationId', { locationId: targetLocationId })
        .andWhere('UPPER(r.code) = :code', { code: normalizedCode })
        .andWhere('r.id != :id', { id })
        .getOne();

      if (existing) {
        throw new ConflictException(
          `Rack code "${normalizedCode}" already exists in this Location.`,
        );
      }
      rack.code = normalizedCode;
    }

    if (dto.name !== undefined) {
      rack.name = dto.name.trim();
    }
    if (dto.isActive !== undefined) {
      rack.isActive = dto.isActive;
    }

    return this.rackRepo.save(rack);
  }

  // ==========================================
  // 7. BINS
  // ==========================================
  async createBin(dto: CreateBinDto) {
    const rack = await this.rackRepo.findOneBy({ id: dto.rackId });
    if (!rack) {
      throw new NotFoundException(`Parent Rack with ID "${dto.rackId}" not found.`);
    }

    const normalizedCode = dto.code.trim().toUpperCase();
    const trimmedName = dto.name.trim();

    const existingCode = await this.binRepo
      .createQueryBuilder('b')
      .where('b.rackId = :rackId', { rackId: dto.rackId })
      .andWhere('UPPER(b.code) = :code', { code: normalizedCode })
      .getOne();

    if (existingCode) {
      throw new ConflictException(`Bin code "${normalizedCode}" already exists in this Rack.`);
    }

    const bin = this.binRepo.create({
      rackId: dto.rackId,
      code: normalizedCode,
      name: trimmedName,
      isActive: dto.isActive ?? true,
    });
    return this.binRepo.save(bin);
  }

  async findBins(filter: MasterFilterDto) {
    const { search, isActive, parentId, page = 1, pageSize = 20 } = filter;
    const qb = this.binRepo
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.rack', 'rack')
      .leftJoinAndSelect('rack.location', 'location')
      .leftJoinAndSelect('location.warehouse', 'warehouse');

    if (parentId) {
      qb.andWhere('b.rackId = :parentId', { parentId });
    }
    if (search) {
      qb.andWhere('(b.name ILIKE :search OR b.code ILIKE :search)', { search: `%${search}%` });
    }
    if (isActive !== undefined) {
      qb.andWhere('b.isActive = :isActive', { isActive });
    }

    qb.orderBy('b.code', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findBinById(id: string) {
    const bin = await this.binRepo.findOne({
      where: { id },
      relations: { rack: { location: { warehouse: true } } },
    });
    if (!bin) {
      throw new NotFoundException(`Bin with ID "${id}" not found.`);
    }
    return bin;
  }

  async updateBin(id: string, dto: UpdateBinDto) {
    const bin = await this.findBinById(id);

    const targetRackId = dto.rackId ?? bin.rackId;
    if (dto.rackId !== undefined) {
      const rack = await this.rackRepo.findOneBy({ id: dto.rackId });
      if (!rack) {
        throw new NotFoundException(`Parent Rack with ID "${dto.rackId}" not found.`);
      }
      bin.rackId = dto.rackId;
    }

    if (dto.code !== undefined) {
      const normalizedCode = dto.code.trim().toUpperCase();
      const existing = await this.binRepo
        .createQueryBuilder('b')
        .where('b.rackId = :rackId', { rackId: targetRackId })
        .andWhere('UPPER(b.code) = :code', { code: normalizedCode })
        .andWhere('b.id != :id', { id })
        .getOne();

      if (existing) {
        throw new ConflictException(`Bin code "${normalizedCode}" already exists in this Rack.`);
      }
      bin.code = normalizedCode;
    }

    if (dto.name !== undefined) {
      bin.name = dto.name.trim();
    }
    if (dto.isActive !== undefined) {
      bin.isActive = dto.isActive;
    }

    return this.binRepo.save(bin);
  }
}
