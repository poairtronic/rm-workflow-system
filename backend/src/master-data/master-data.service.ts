import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  HttpException,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import { ProductCategory } from '../inventory/entities/product-category.entity.js';
import { ProductFamily } from '../inventory/entities/product-family.entity.js';
import { Product } from '../inventory/entities/product.entity.js';
import { Warehouse } from '../inventory/entities/warehouse.entity.js';
import { WarehouseLocation } from '../inventory/entities/warehouse-location.entity.js';
import { Rack } from '../inventory/entities/rack.entity.js';
import { Bin } from '../inventory/entities/bin.entity.js';
import { StockBalance } from '../inventory/entities/stock-balance.entity.js';
import { StockTransaction, TransactionType } from '../inventory/entities/stock-transaction.entity.js';

import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto.js';
import { CreateFamilyDto, UpdateFamilyDto } from './dto/family.dto.js';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto.js';
import { CreateWarehouseDto, UpdateWarehouseDto } from './dto/warehouse.dto.js';
import { CreateLocationDto, UpdateLocationDto, RelocateAndDeleteLocationDto } from './dto/location.dto.js';
import { CreateRackDto, UpdateRackDto } from './dto/rack.dto.js';
import { CreateBinDto, UpdateBinDto } from './dto/bin.dto.js';
import { MasterFilterDto } from './dto/master-filter.dto.js';

@Injectable()
export class MasterDataService implements OnModuleInit {
  private readonly logger = new Logger(MasterDataService.name);

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
    @InjectRepository(StockBalance)
    private readonly stockBalanceRepo: Repository<StockBalance>,
    @InjectRepository(StockTransaction)
    private readonly stockTransactionRepo: Repository<StockTransaction>,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit() {
    try {
      await this.backfillBarcodes();
    } catch (err: any) {
      console.warn('[MasterDataService] Barcode backfill check on startup:', err?.message || err);
    }
  }

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
      throw new ConflictException(
        `Category with name "${trimmedName}" already exists.`,
      );
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
    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
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
        throw new ConflictException(
          `Category with name "${trimmedName}" already exists.`,
        );
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
    return {
      success: true,
      message: `Category "${category.name}" deleted successfully.`,
    };
  }

  // ==========================================
  // 2. PRODUCT FAMILIES
  // ==========================================
  async createFamily(dto: CreateFamilyDto) {
    const category = await this.categoryRepo.findOneBy({ id: dto.categoryId });
    if (!category) {
      throw new NotFoundException(
        `Parent Category with ID "${dto.categoryId}" not found.`,
      );
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
    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
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
      const category = await this.categoryRepo.findOneBy({
        id: dto.categoryId,
      });
      if (!category) {
        throw new NotFoundException(
          `Parent Category with ID "${dto.categoryId}" not found.`,
        );
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

  async deleteFamily(id: string) {
    const family = await this.findFamilyById(id);
    const productCount = await this.productRepo.count({
      where: { familyId: id },
    });

    if (productCount > 0) {
      throw new ConflictException(
        `Cannot delete family "${family.name}" because it contains ${productCount} products. Deactivate it instead.`,
      );
    }

    await this.familyRepo.remove(family);
    return {
      success: true,
      message: `Family "${family.name}" deleted successfully.`,
    };
  }

  // ==========================================
  // 3. PRODUCTS
  // ==========================================
  private async resolveOrCreateFamily(dto: {
    familyId?: string;
    categoryId?: string;
    categoryName?: string;
    familyName?: string;
  }): Promise<string> {
    if (dto.familyId) {
      const family = await this.familyRepo.findOneBy({ id: dto.familyId });
      if (!family) {
        throw new NotFoundException(
          `Parent Family with ID "${dto.familyId}" not found.`,
        );
      }
      return family.id;
    }

    if (dto.familyName && dto.familyName.trim()) {
      const trimmedFamilyName = dto.familyName.trim();
      let targetCategoryId = dto.categoryId;

      if (!targetCategoryId && dto.categoryName && dto.categoryName.trim()) {
        const trimmedCatName = dto.categoryName.trim();
        let cat = await this.categoryRepo
          .createQueryBuilder('c')
          .where('LOWER(c.name) = LOWER(:name)', { name: trimmedCatName })
          .getOne();
        if (!cat) {
          cat = await this.categoryRepo.save(
            this.categoryRepo.create({ name: trimmedCatName, isActive: true }),
          );
        }
        targetCategoryId = cat.id;
      } else if (!targetCategoryId) {
        // Fallback: search or create a General category
        let defaultCat = await this.categoryRepo
          .createQueryBuilder('c')
          .where('LOWER(c.name) = LOWER(:name)', { name: 'General' })
          .getOne();
        if (!defaultCat) {
          defaultCat = await this.categoryRepo.save(
            this.categoryRepo.create({ name: 'General', isActive: true }),
          );
        }
        targetCategoryId = defaultCat.id;
      }

      let fam = await this.familyRepo
        .createQueryBuilder('f')
        .where('f.categoryId = :categoryId', { categoryId: targetCategoryId })
        .andWhere('LOWER(f.name) = LOWER(:name)', { name: trimmedFamilyName })
        .getOne();
      if (!fam) {
        fam = await this.familyRepo.save(
          this.familyRepo.create({
            categoryId: targetCategoryId,
            name: trimmedFamilyName,
            isActive: true,
          }),
        );
      }
      return fam.id;
    }

    throw new BadRequestException(
      'A valid familyId or familyName must be provided.',
    );
  }

  async generateUniqueBarcode(preferredCode?: string): Promise<string> {
    const rawCode = (preferredCode || '').trim().toUpperCase();
    if (rawCode) {
      const candidate = rawCode.startsWith('PRD-') ? rawCode : `PRD-${rawCode}`;
      try {
        const existing = await this.productRepo.findOne({
          where: { barcode: candidate },
        });
        if (!existing) {
          return candidate;
        }
      } catch {
        // Fallback for minimal test environments
      }
    }

    let existingBarcodes: { barcode?: string }[] = [];
    try {
      const qb = this.productRepo.createQueryBuilder('p');
      if (typeof qb.getRawMany === 'function') {
        existingBarcodes = await qb
          .select('p.barcode', 'barcode')
          .where("p.barcode LIKE 'PRD-%'")
          .getRawMany();
      } else if (typeof this.productRepo.find === 'function') {
        existingBarcodes = await this.productRepo.find({ select: { barcode: true } as any });
      }
    } catch {
      // Fallback for minimal test environments
    }

    let maxNum = 0;
    for (const row of existingBarcodes) {
      if (row?.barcode) {
        const match = row.barcode.match(/^PRD-(\d+)$/i);
        if (match) {
          const val = parseInt(match[1], 10);
          if (!isNaN(val) && val > maxNum) {
            maxNum = val;
          }
        }
      }
    }

    let candidateNum = maxNum + 1;
    let candidateBarcode = `PRD-${String(candidateNum).padStart(6, '0')}`;

    while (
      await this.productRepo.findOne({
        where: { barcode: candidateBarcode },
      })
    ) {
      candidateNum++;
      candidateBarcode = `PRD-${String(candidateNum).padStart(6, '0')}`;
    }

    return candidateBarcode;
  }

  async generateUniqueProductCode(): Promise<string> {
    let existingCodes: { code?: string }[] = [];
    try {
      const qb = this.productRepo.createQueryBuilder('p');
      if (typeof qb.getRawMany === 'function') {
        existingCodes = await qb
          .select('p.code', 'code')
          .where('p.code IS NOT NULL')
          .getRawMany();
      } else if (typeof this.productRepo.find === 'function') {
        existingCodes = await this.productRepo.find({ select: { code: true } as any });
      }
    } catch {
      // Fallback for minimal test environments
    }

    let maxNum = 0;
    for (const row of existingCodes) {
      if (row?.code) {
        // Matches RM-0001, RM-0450, RM 0450, etc.
        const match = row.code.match(/^RM\s*[-_]?\s*(\d+)$/i);
        if (match) {
          const val = parseInt(match[1], 10);
          if (!isNaN(val) && val > maxNum) {
            maxNum = val;
          }
        }
      }
    }

    let candidateNum = maxNum + 1;
    let candidateCode = `RM-${String(candidateNum).padStart(4, '0')}`;

    // Ensure candidateCode doesn't already exist
    while (
      await this.productRepo
        .createQueryBuilder('p')
        .where('UPPER(p.code) = :code', { code: candidateCode })
        .getOne()
    ) {
      candidateNum++;
      candidateCode = `RM-${String(candidateNum).padStart(4, '0')}`;
    }

    return candidateCode;
  }

  async createProduct(dto: CreateProductDto) {
    let normalizedCode = (dto.code || '').trim().toUpperCase();
    if (!normalizedCode) {
      normalizedCode = await this.generateUniqueProductCode();
    } else {
      const existingCode = await this.productRepo
        .createQueryBuilder('p')
        .where('UPPER(p.code) = :code', { code: normalizedCode })
        .getOne();
      if (existingCode) {
        throw new ConflictException(
          `Product with code "${normalizedCode}" already exists.`,
        );
      }
    }

    let barcodeToUse: string;
    if (dto.barcode && dto.barcode.trim()) {
      const trimmedBarcode = dto.barcode.trim();
      const existingBarcode = await this.productRepo.findOne({
        where: { barcode: trimmedBarcode },
      });
      if (existingBarcode) {
        throw new ConflictException(
          `Product with barcode "${trimmedBarcode}" already exists.`,
        );
      }
      barcodeToUse = trimmedBarcode;
    } else {
      barcodeToUse = await this.generateUniqueBarcode(normalizedCode);
    }

    const resolvedFamilyId = await this.resolveOrCreateFamily(dto);

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
      throw new ConflictException(
        `Product with name "${trimmedName}" already exists.`,
      );
    }

    const normalizedUom = (dto.uom || 'KG').trim().toUpperCase();

    const product = this.productRepo.create({
      code: normalizedCode,
      barcode: barcodeToUse,
      familyId: resolvedFamilyId,
      name: trimmedName,
      uom: normalizedUom,
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
      qb.andWhere('(p.name ILIKE :search OR p.code ILIKE :search OR p.barcode ILIKE :search)', {
        search: `%${search}%`,
      });
    }
    if (isActive !== undefined) {
      qb.andWhere('p.isActive = :isActive', { isActive });
    }

    qb.orderBy('p.name', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [data, total] = await qb.getManyAndCount();
    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
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

  async findProductByBarcode(barcode: string) {
    const trimmed = (barcode || '').trim();
    if (!trimmed) {
      throw new BadRequestException('Barcode cannot be empty.');
    }

    const strippedPrd = trimmed.replace(/^PRD[-_:\s]+/i, '').trim();
    const withPrd = trimmed.toUpperCase().startsWith('PRD-')
      ? trimmed.toUpperCase()
      : `PRD-${trimmed.toUpperCase()}`;

    const qb = this.productRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.family', 'family')
      .leftJoinAndSelect('family.category', 'category')
      .leftJoinAndSelect('p.stockBalances', 'stockBalances')
      .leftJoinAndSelect('stockBalances.bin', 'bin')
      .leftJoinAndSelect('bin.rack', 'rack')
      .leftJoinAndSelect('rack.location', 'location')
      .leftJoinAndSelect('location.warehouse', 'warehouse')
      .where(
        `(
          p.barcode = :barcode OR LOWER(p.barcode) = LOWER(:barcode)
          OR p.barcode = :withPrd OR LOWER(p.barcode) = LOWER(:withPrd)
          OR p.code = :barcode OR LOWER(p.code) = LOWER(:barcode)
          OR p.code = :strippedPrd OR LOWER(p.code) = LOWER(:strippedPrd)
          OR p.name = :barcode OR LOWER(p.name) = LOWER(:barcode)
          OR p.name = :strippedPrd OR LOWER(p.name) = LOWER(:strippedPrd)
        )`,
        {
          barcode: trimmed,
          strippedPrd: strippedPrd || trimmed,
          withPrd,
        },
      );

    let product = await qb.getOne();

    // Fallback search: case-insensitive partial/exact match on code or name
    if (!product) {
      const targetQuery = strippedPrd || trimmed;
      const fallbackQb = this.productRepo
        .createQueryBuilder('p')
        .leftJoinAndSelect('p.family', 'family')
        .leftJoinAndSelect('family.category', 'category')
        .leftJoinAndSelect('p.stockBalances', 'stockBalances')
        .leftJoinAndSelect('stockBalances.bin', 'bin')
        .leftJoinAndSelect('bin.rack', 'rack')
        .leftJoinAndSelect('rack.location', 'location')
        .leftJoinAndSelect('location.warehouse', 'warehouse')
        .where('p.code ILIKE :exactCode OR p.name ILIKE :exactName', {
          exactCode: targetQuery,
          exactName: targetQuery,
        });
      product = await fallbackQb.getOne();
    }

    if (!product) {
      throw new NotFoundException(`Product with barcode "${trimmed}" not found.`);
    }

    // Auto-link: If product exists in database but product.barcode was null or empty,
    // immediately persist this scanned barcode so future lookups are instantaneous!
    if (!product.barcode) {
      try {
        const assignedBarcode = trimmed.toUpperCase().startsWith('PRD-') ? trimmed.toUpperCase() : withPrd;
        await this.productRepo.update(product.id, { barcode: assignedBarcode });
        product.barcode = assignedBarcode;
      } catch {
        // Ignore background auto-link error if collision
      }
    }

    const totalQuantity = (product.stockBalances || []).reduce(
      (sum, sb) => sum + Number(sb.currentQuantity || 0),
      0,
    );

    return {
      ...product,
      totalQuantity,
    };
  }

  async backfillBarcodes() {
    let productsWithoutBarcode: Product[] = [];
    try {
      productsWithoutBarcode = await this.productRepo
        .createQueryBuilder('p')
        .where('p.barcode IS NULL OR p.barcode = :empty', { empty: '' })
        .orderBy('p.createdAt', 'ASC')
        .addOrderBy('p.code', 'ASC')
        .getMany();
    } catch {
      return {
        success: false,
        count: 0,
        message: 'Could not query products table for barcode backfill.',
      };
    }

    if (productsWithoutBarcode.length === 0) {
      return {
        success: true,
        count: 0,
        message: 'All products already have unique barcodes assigned.',
      };
    }

    let existingBarcodes: { barcode?: string }[] = [];
    try {
      existingBarcodes = await this.productRepo
        .createQueryBuilder('p')
        .select('p.barcode', 'barcode')
        .where('p.barcode IS NOT NULL AND p.barcode != :empty', { empty: '' })
        .getRawMany();
    } catch {
      existingBarcodes = [];
    }

    const usedBarcodes = new Set<string>();
    let maxNum = 0;
    for (const row of existingBarcodes) {
      if (row.barcode) {
        usedBarcodes.add(row.barcode.toUpperCase());
        const match = row.barcode.match(/^PRD-(\d+)$/i);
        if (match) {
          const val = parseInt(match[1], 10);
          if (!isNaN(val) && val > maxNum) {
            maxNum = val;
          }
        }
      }
    }

    let nextNum = maxNum;
    for (const prod of productsWithoutBarcode) {
      let candidateBarcode = '';
      const rawCode = (prod.code || '').trim().toUpperCase();
      if (rawCode) {
        const codeCandidate = rawCode.startsWith('PRD-') ? rawCode : `PRD-${rawCode}`;
        if (!usedBarcodes.has(codeCandidate.toUpperCase())) {
          candidateBarcode = codeCandidate;
        }
      }

      if (!candidateBarcode) {
        do {
          nextNum++;
          candidateBarcode = `PRD-${String(nextNum).padStart(6, '0')}`;
        } while (usedBarcodes.has(candidateBarcode.toUpperCase()));
      }

      usedBarcodes.add(candidateBarcode.toUpperCase());
      prod.barcode = candidateBarcode;
    }

    await this.productRepo.save(productsWithoutBarcode, { chunk: 100 });

    return {
      success: true,
      count: productsWithoutBarcode.length,
      message: `Successfully linked ${productsWithoutBarcode.length} product(s) with correct barcodes.`,
    };
  }

  async updateProduct(id: string, dto: UpdateProductDto) {
    const product = await this.findProductById(id);

    if (dto.code !== undefined) {
      const normalizedCode = dto.code.trim().toUpperCase();
      if (!normalizedCode) {
        throw new BadRequestException('Product code cannot be empty.');
      }
      const existingCode = await this.productRepo
        .createQueryBuilder('p')
        .where('UPPER(p.code) = :code', { code: normalizedCode })
        .andWhere('p.id != :id', { id })
        .getOne();
      if (existingCode) {
        throw new ConflictException(
          `Product with code "${normalizedCode}" already exists.`,
        );
      }
      product.code = normalizedCode;
    }

    if (dto.barcode !== undefined) {
      const trimmedBarcode = dto.barcode?.trim();
      if (trimmedBarcode) {
        const existingBarcode = await this.productRepo
          .createQueryBuilder('p')
          .where('p.barcode = :barcode', { barcode: trimmedBarcode })
          .andWhere('p.id != :id', { id })
          .getOne();
        if (existingBarcode) {
          throw new ConflictException(
            `Product with barcode "${trimmedBarcode}" already exists.`,
          );
        }
        product.barcode = trimmedBarcode;
      } else {
        product.barcode = await this.generateUniqueBarcode();
      }
    }

    if (dto.uom !== undefined) {
      product.uom = dto.uom.trim().toUpperCase();
    }

    if (dto.familyId !== undefined || dto.familyName !== undefined) {
      product.familyId = await this.resolveOrCreateFamily(dto);
    }

    if (dto.name !== undefined) {
      const trimmedName = dto.name.trim();
      const existing = await this.productRepo
        .createQueryBuilder('p')
        .where('LOWER(p.name) = LOWER(:name)', { name: trimmedName })
        .andWhere('p.id != :id', { id })
        .getOne();

      if (existing) {
        throw new ConflictException(
          `Product with name "${trimmedName}" already exists.`,
        );
      }
      product.name = trimmedName;
    }

    const min = dto.minimumInventory ?? product.minimumInventory;
    const max =
      dto.maximumInventory !== undefined
        ? dto.maximumInventory
        : product.maximumInventory;
    if (max !== undefined && max !== null && max < min) {
      throw new BadRequestException(
        `maximumInventory (${max}) cannot be less than minimumInventory (${min}).`,
      );
    }

    if (dto.minimumInventory !== undefined)
      product.minimumInventory = dto.minimumInventory;
    if (dto.maximumInventory !== undefined)
      product.maximumInventory = dto.maximumInventory;
    if (dto.isActive !== undefined) product.isActive = dto.isActive;

    return this.productRepo.save(product);
  }

  async deleteProduct(id: string) {
    const product = await this.findProductById(id);

    // 1. Check stock transactions referencing this product
    const txCount = await this.stockTransactionRepo.count({
      where: { productId: id },
    });
    if (txCount > 0) {
      throw new BadRequestException(
        `Cannot delete product "${product.name}" (${product.code}) because it has ${txCount} historical stock transaction(s). You can deactivate it instead.`,
      );
    }

    // 2. Check stock balances with non-zero quantities
    const balances = await this.stockBalanceRepo.find({
      where: { productId: id },
    });
    const hasPositiveStock = balances.some(
      (b) => Number(b.currentQuantity) > 0,
    );
    if (hasPositiveStock) {
      throw new BadRequestException(
        `Cannot delete product "${product.name}" (${product.code}) because it currently holds active stock. Please transfer or adjust the inventory to 0, or deactivate the product.`,
      );
    }

    // 3. Check delivery challan items
    const dcResult = await this.productRepo.manager.query(
      `SELECT COUNT(*)::int as count FROM delivery_challan_items WHERE product_id = $1 OR output_product_id = $1`,
      [id],
    );
    const dcCount = Number(dcResult[0]?.count || 0);
    if (dcCount > 0) {
      throw new BadRequestException(
        `Cannot delete product "${product.name}" (${product.code}) because it is referenced in delivery challans. You can deactivate it instead.`,
      );
    }

    // 4. Check general issue items
    const issueResult = await this.productRepo.manager.query(
      `SELECT COUNT(*)::int as count FROM general_issue_items WHERE product_id = $1`,
      [id],
    );
    const issueCount = Number(issueResult[0]?.count || 0);
    if (issueCount > 0) {
      throw new BadRequestException(
        `Cannot delete product "${product.name}" (${product.code}) because it is referenced in material issues. You can deactivate it instead.`,
      );
    }

    // 5. Check RM items mapped to this product
    const rmResult = await this.productRepo.manager.query(
      `SELECT COUNT(*)::int as count FROM rm_items WHERE mapped_product_id = $1`,
      [id],
    );
    const rmCount = Number(rmResult[0]?.count || 0);
    if (rmCount > 0) {
      throw new BadRequestException(
        `Cannot delete product "${product.name}" (${product.code}) because it is mapped to RM requisition item(s). You can deactivate it instead.`,
      );
    }

    // 6. Check DC movements
    const dcMovementsResult = await this.productRepo.manager.query(
      `SELECT COUNT(*)::int as count FROM dc_movements WHERE dispatched_product_id = $1 OR returned_product_id = $1`,
      [id],
    );
    const dcMovementsCount = Number(dcMovementsResult[0]?.count || 0);
    if (dcMovementsCount > 0) {
      throw new BadRequestException(
        `Cannot delete product "${product.name}" (${product.code}) because it is referenced in DC movements. You can deactivate it instead.`,
      );
    }

    // 7. Check rework items
    const reworkResult = await this.productRepo.manager.query(
      `SELECT COUNT(*)::int as count FROM dc_rework_items WHERE product_id = $1`,
      [id],
    );
    const reworkCount = Number(reworkResult[0]?.count || 0);
    if (reworkCount > 0) {
      throw new BadRequestException(
        `Cannot delete product "${product.name}" (${product.code}) because it is referenced in rework items. You can deactivate it instead.`,
      );
    }

    // 8. Check consumable request items
    const consumableItems = await this.productRepo.manager.query(
      `SELECT COUNT(*)::int as total, 
              COUNT(CASE WHEN real_received_qty > 0 OR issued_qty > 0 THEN 1 END)::int as fulfilled 
       FROM consumable_request_items WHERE product_id = $1`,
      [id],
    );
    const totalConsumable = Number(consumableItems[0]?.total || 0);
    const fulfilledConsumable = Number(consumableItems[0]?.fulfilled || 0);

    if (fulfilledConsumable > 0) {
      throw new BadRequestException(
        `Cannot delete product "${product.name}" (${product.code}) because it has been fulfilled/issued in consumable requests. You can deactivate it instead.`,
      );
    }

    // Safe to delete! Clean up any zero-balance records, MSL alerts & unfulfilled consumable request items
    if (totalConsumable > 0) {
      await this.productRepo.manager.query(
        `DELETE FROM consumable_request_items WHERE product_id = $1`,
        [id],
      );
    }
    await this.productRepo.manager.query(
      `DELETE FROM stock_balances WHERE product_id = $1`,
      [id],
    );
    await this.productRepo.manager.query(
      `DELETE FROM msl_alerts WHERE product_id = $1`,
      [id],
    );

    try {
      await this.productRepo.remove(product);
    } catch (err: any) {
      this.logger.error(`Failed to delete product ${id}: ${err?.message}`, err?.stack);
      if (err?.code === '23503') {
        throw new BadRequestException(
          `Cannot delete product "${product.name}" (${product.code}) because it is referenced by other system records. You can deactivate it instead.`,
        );
      }
      throw err;
    }

    return {
      success: true,
      message: `Product "${product.name}" (${product.code}) deleted successfully.`,
    };
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
      throw new ConflictException(
        `Warehouse code "${normalizedCode}" already exists.`,
      );
    }

    const existingName = await this.warehouseRepo
      .createQueryBuilder('w')
      .where('LOWER(w.name) = LOWER(:name)', { name: trimmedName })
      .getOne();

    if (existingName) {
      throw new ConflictException(
        `Warehouse name "${trimmedName}" already exists.`,
      );
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
      qb.andWhere('(w.name ILIKE :search OR w.code ILIKE :search)', {
        search: `%${search}%`,
      });
    }
    if (isActive !== undefined) {
      qb.andWhere('w.isActive = :isActive', { isActive });
    }

    qb.orderBy('w.code', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [data, total] = await qb.getManyAndCount();
    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
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
        throw new ConflictException(
          `Warehouse code "${normalizedCode}" already exists.`,
        );
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
        throw new ConflictException(
          `Warehouse name "${trimmedName}" already exists.`,
        );
      }
      warehouse.name = trimmedName;
    }

    if (dto.isActive !== undefined) {
      warehouse.isActive = dto.isActive;
    }

    return this.warehouseRepo.save(warehouse);
  }

  async deleteWarehouse(id: string, _cascade = false) {
    const warehouse = await this.findWarehouseById(id);
    const locationCount = await this.locationRepo.count({
      where: { warehouseId: id },
    });

    if (locationCount > 0) {
      throw new ConflictException(
        `Cannot delete warehouse "${warehouse.name}" because it contains ${locationCount} storage location(s). All warehouse locations must be deleted first.`,
      );
    }

    await this.warehouseRepo.remove(warehouse);
    return {
      success: true,
      message: `Warehouse "${warehouse.name}" deleted successfully.`,
    };
  }

  // ==========================================
  // 5. WAREHOUSE LOCATIONS
  // ==========================================
  async createLocation(dto: CreateLocationDto) {
    const warehouse = await this.warehouseRepo.findOneBy({
      id: dto.warehouseId,
    });
    if (!warehouse) {
      throw new NotFoundException(
        `Parent Warehouse with ID "${dto.warehouseId}" not found.`,
      );
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
      qb.andWhere('(l.name ILIKE :search OR l.code ILIKE :search)', {
        search: `%${search}%`,
      });
    }
    if (isActive !== undefined) {
      qb.andWhere('l.isActive = :isActive', { isActive });
    }

    qb.orderBy('l.code', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [data, total] = await qb.getManyAndCount();
    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
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
      const warehouse = await this.warehouseRepo.findOneBy({
        id: dto.warehouseId,
      });
      if (!warehouse) {
        throw new NotFoundException(
          `Parent Warehouse with ID "${dto.warehouseId}" not found.`,
        );
      }
      location.warehouseId = dto.warehouseId;
    }

    if (dto.code !== undefined) {
      const normalizedCode = dto.code.trim().toUpperCase();
      const existing = await this.locationRepo
        .createQueryBuilder('l')
        .where('l.warehouseId = :warehouseId', {
          warehouseId: targetWarehouseId,
        })
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

  async getLocationActiveStocks(locationId: string) {
    await this.findLocationById(locationId);
    const racks = await this.rackRepo.find({
      where: { locationId },
    });
    const rackIds = racks.map((r) => r.id);
    if (rackIds.length === 0) return [];

    const bins = await this.binRepo.find({
      where: { rackId: In(rackIds) },
    });
    const binIds = bins.map((b) => b.id);
    if (binIds.length === 0) return [];

    const balances = await this.stockBalanceRepo
      .createQueryBuilder('sb')
      .leftJoinAndSelect('sb.product', 'product')
      .leftJoinAndSelect('sb.bin', 'bin')
      .leftJoinAndSelect('bin.rack', 'rack')
      .where('sb.bin_id IN (:...binIds)', { binIds })
      .andWhere('sb.current_quantity != 0')
      .getMany();

    return balances.map((b) => ({
      balanceId: b.id,
      productId: b.productId,
      productName: b.product?.name || 'Unknown Product',
      productCode: b.product?.code || 'N/A',
      uom: b.product?.uom || 'KG',
      quantity: Number(b.currentQuantity),
      currentBinId: b.binId,
      currentBinCode: b.bin?.code || 'N/A',
      currentRackId: b.bin?.rackId,
      currentRackCode: b.bin?.rack?.code || 'N/A',
    }));
  }

  async relocateAndDeleteLocation(
    locationId: string,
    dto: RelocateAndDeleteLocationDto,
    userId: string,
  ) {
    const location = await this.findLocationById(locationId);
    const racks = await this.rackRepo.find({ where: { locationId } });
    const rackIds = racks.map((r) => r.id);
    const bins =
      rackIds.length > 0
        ? await this.binRepo.find({ where: { rackId: In(rackIds) } })
        : [];
    const binIds = bins.map((b) => b.id);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Resolve a guaranteed valid user ID for StockTransaction audit ledger
      let validUserId: string | null = null;
      const isUuid =
        typeof userId === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          userId,
        );
      if (isUuid) {
        const userExists = await queryRunner.manager.query(
          `SELECT id FROM users WHERE id = $1 LIMIT 1`,
          [userId],
        );
        if (userExists && userExists.length > 0) {
          validUserId = userExists[0].id;
        }
      }
      if (!validUserId) {
        const fallbackUser = await queryRunner.manager.query(
          `SELECT id FROM users WHERE is_active = true ORDER BY created_at ASC LIMIT 1`,
        );
        validUserId = fallbackUser?.[0]?.id || null;
      }
      if (!validUserId) {
        const anyUser = await queryRunner.manager.query(
          `SELECT id FROM users ORDER BY created_at ASC LIMIT 1`,
        );
        validUserId = anyUser?.[0]?.id || null;
      }

      // 2. Process each transfer atomically
      for (const t of dto.transfers || []) {
        if (
          !t.productId ||
          !t.sourceBinId ||
          !t.targetBinId ||
          Number(t.quantity) <= 0
        )
          continue;
        if (t.sourceBinId === t.targetBinId) {
          throw new BadRequestException(
            'Target bin must be different from source bin.',
          );
        }

        if (binIds.includes(t.targetBinId)) {
          throw new BadRequestException(
            'Target bin cannot be inside the location being deleted.',
          );
        }

        const transaction = this.stockTransactionRepo.create({
          productId: t.productId,
          sourceBinId: t.sourceBinId,
          destinationBinId: t.targetBinId,
          transactionType: TransactionType.TRANSFER,
          quantity: Number(t.quantity),
          referenceType: 'LOCATION_DECOMMISSION',
          reason: `Stock relocated prior to deletion of location "${location.name}"`,
          remarks: `Automated inventory shift from ${location.name} to target storage unit.`,
          createdById: validUserId || undefined,
        });
        const savedTx = await queryRunner.manager.save(transaction);

        // Deduct from source balance
        await queryRunner.manager.query(
          `UPDATE stock_balances 
           SET current_quantity = current_quantity - $1, 
               last_transaction_id = $2, 
               updated_at = NOW() 
           WHERE product_id = $3 AND bin_id = $4`,
          [t.quantity, savedTx.id, t.productId, t.sourceBinId],
        );

        // Safely update or insert target balance with conflict avoidance
        const existingTarget = await queryRunner.manager.query(
          `SELECT id FROM stock_balances WHERE product_id = $1 AND bin_id = $2 LIMIT 1`,
          [t.productId, t.targetBinId],
        );

        if (existingTarget && existingTarget.length > 0) {
          await queryRunner.manager.query(
            `UPDATE stock_balances 
             SET current_quantity = current_quantity + $1, 
                 last_transaction_id = $2, 
                 updated_at = NOW() 
             WHERE id = $3`,
            [t.quantity, savedTx.id, existingTarget[0].id],
          );
        } else {
          await queryRunner.manager.query(
            `INSERT INTO stock_balances (product_id, bin_id, current_quantity, opening_balance, last_transaction_id, created_at, updated_at) 
             VALUES ($1, $2, $3, 0, $4, NOW(), NOW())`,
            [t.productId, t.targetBinId, t.quantity, savedTx.id],
          );
        }
      }

      // 3. Unlink and remove bins safely if bins exist
      if (binIds.length > 0) {
        // Disassociate Delivery Challan items
        await queryRunner.manager.query(
          `UPDATE delivery_challan_items SET bin_id = NULL WHERE bin_id = ANY($1::uuid[])`,
          [binIds],
        );
        await queryRunner.manager.query(
          `UPDATE delivery_challan_items SET output_bin_id = NULL WHERE output_bin_id = ANY($1::uuid[])`,
          [binIds],
        );
        await queryRunner.manager.query(
          `UPDATE delivery_challan_items SET return_target_bin_id = NULL WHERE return_target_bin_id = ANY($1::uuid[])`,
          [binIds],
        );

        // Disassociate Consumable Request items
        await queryRunner.manager.query(
          `UPDATE consumable_request_items SET bin_id = NULL WHERE bin_id = ANY($1::uuid[])`,
          [binIds],
        );

        // Disassociate General Issue items
        try {
          await queryRunner.manager.query(
            `ALTER TABLE general_issue_items ALTER COLUMN bin_id DROP NOT NULL`,
          );
          await queryRunner.manager.query(
            `UPDATE general_issue_items SET bin_id = NULL WHERE bin_id = ANY($1::uuid[])`,
            [binIds],
          );
        } catch (_err) {
          // Table might not exist in testing environment
        }

        // Delete stock_balances inside these bins
        await queryRunner.manager.query(
          `DELETE FROM stock_balances WHERE bin_id = ANY($1::uuid[])`,
          [binIds],
        );

        // Disassociate FK on historical stock transactions
        await queryRunner.manager.query(
          `UPDATE stock_transactions SET source_bin_id = NULL WHERE source_bin_id = ANY($1::uuid[])`,
          [binIds],
        );
        await queryRunner.manager.query(
          `UPDATE stock_transactions SET destination_bin_id = NULL WHERE destination_bin_id = ANY($1::uuid[])`,
          [binIds],
        );

        // Delete bins
        await queryRunner.manager.query(
          `DELETE FROM bins WHERE id = ANY($1::uuid[])`,
          [binIds],
        );
      }

      if (rackIds.length > 0) {
        await queryRunner.manager.query(
          `DELETE FROM racks WHERE id = ANY($1::uuid[])`,
          [rackIds],
        );
      }

      await queryRunner.manager.query(
        `DELETE FROM warehouse_locations WHERE id = $1`,
        [locationId],
      );

      await queryRunner.commitTransaction();
      return {
        success: true,
        message: `Location "${location.name}" deleted successfully. All inventory transferred to selected bins.`,
      };
    } catch (err: any) {
      await queryRunner.rollbackTransaction();
      if (err instanceof HttpException) {
        throw err;
      }
      throw new BadRequestException(
        err?.message
          ? `Unable to complete shift: ${err.message}`
          : 'Unable to complete shift and delete location.',
      );
    } finally {
      await queryRunner.release();
    }
  }

  async deleteLocation(id: string, cascade = false) {
    const location = await this.findLocationById(id);
    const rackCount = await this.rackRepo.count({
      where: { locationId: id },
    });

    if (rackCount > 0 && !cascade) {
      throw new ConflictException(
        `Cannot delete location "${location.name}" because it contains ${rackCount} racks. Deactivate it instead.`,
      );
    }

    if (rackCount > 0 && cascade) {
      const racks = await this.rackRepo.find({
        where: { locationId: id },
      });
      const rackIds = racks.map((r) => r.id);
      const bins =
        rackIds.length > 0
          ? await this.binRepo.find({
              where: { rackId: In(rackIds) },
            })
          : [];
      const binIds = bins.map((b) => b.id);

      if (binIds.length > 0) {
        const activeBalances = await this.stockBalanceRepo
          .createQueryBuilder('sb')
          .where('sb.bin_id IN (:...binIds)', { binIds })
          .andWhere('sb.current_quantity != 0')
          .getCount();

        if (activeBalances > 0) {
          throw new ConflictException(
            `Cannot delete location "${location.name}" because its storage units contain active stock balances (${activeBalances}). Please transfer or relocate stock before deleting.`,
          );
        }

        if (this.dataSource) {
          // Disassociate Delivery Challan items
          await this.dataSource.query(
            `UPDATE delivery_challan_items SET bin_id = NULL WHERE bin_id = ANY($1::uuid[])`,
            [binIds],
          );
          await this.dataSource.query(
            `UPDATE delivery_challan_items SET output_bin_id = NULL WHERE output_bin_id = ANY($1::uuid[])`,
            [binIds],
          );
          await this.dataSource.query(
            `UPDATE delivery_challan_items SET return_target_bin_id = NULL WHERE return_target_bin_id = ANY($1::uuid[])`,
            [binIds],
          );

          // Disassociate Consumable Request items
          await this.dataSource.query(
            `UPDATE consumable_request_items SET bin_id = NULL WHERE bin_id = ANY($1::uuid[])`,
            [binIds],
          );

          // Disassociate General Issue items
          try {
            await this.dataSource.query(
              `ALTER TABLE general_issue_items ALTER COLUMN bin_id DROP NOT NULL`,
            );
            await this.dataSource.query(
              `UPDATE general_issue_items SET bin_id = NULL WHERE bin_id = ANY($1::uuid[])`,
              [binIds],
            );
          } catch (_err) {}

          // Delete empty stock_balances
          await this.dataSource.query(
            `DELETE FROM stock_balances WHERE bin_id = ANY($1::uuid[])`,
            [binIds],
          );

          // Disassociate FK on historical transactions so ledger is preserved without blocking bin deletion
          await this.dataSource.query(
            `UPDATE stock_transactions SET source_bin_id = NULL WHERE source_bin_id = ANY($1::uuid[])`,
            [binIds],
          );
          await this.dataSource.query(
            `UPDATE stock_transactions SET destination_bin_id = NULL WHERE destination_bin_id = ANY($1::uuid[])`,
            [binIds],
          );
        }

        await this.binRepo.remove(bins);
      }

      await this.rackRepo.remove(racks);
    }

    await this.locationRepo.remove(location);
    return {
      success: true,
      message: `Location "${location.name}" deleted successfully.`,
    };
  }

  // ==========================================
  // 6. RACKS
  // ==========================================
  async createRack(dto: CreateRackDto) {
    const location = await this.locationRepo.findOneBy({ id: dto.locationId });
    if (!location) {
      throw new NotFoundException(
        `Parent Location with ID "${dto.locationId}" not found.`,
      );
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
      .leftJoinAndSelect('location.warehouse', 'warehouse')
      .leftJoinAndSelect('r.bins', 'bins');

    if (parentId) {
      qb.andWhere('r.locationId = :parentId', { parentId });
    }
    if (search) {
      qb.andWhere('(r.name ILIKE :search OR r.code ILIKE :search)', {
        search: `%${search}%`,
      });
    }
    if (isActive !== undefined) {
      qb.andWhere('r.isActive = :isActive', { isActive });
    }

    qb.orderBy('r.code', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [data, total] = await qb.getManyAndCount();
    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
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
      const location = await this.locationRepo.findOneBy({
        id: dto.locationId,
      });
      if (!location) {
        throw new NotFoundException(
          `Parent Location with ID "${dto.locationId}" not found.`,
        );
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

  async deleteRack(id: string, cascade = false) {
    const rack = await this.findRackById(id);
    const binCount = await this.binRepo.count({
      where: { rackId: id },
    });

    if (binCount > 0 && !cascade) {
      throw new ConflictException(
        `Cannot delete rack "${rack.name}" because it contains ${binCount} bins. Deactivate it instead.`,
      );
    }

    if (binCount > 0 && cascade) {
      const bins = await this.binRepo.find({
        where: { rackId: id },
      });
      const binIds = bins.map((b) => b.id);

      if (binIds.length > 0) {
        const balanceCount = await this.stockBalanceRepo.count({
          where: { binId: In(binIds) },
        });
        if (balanceCount > 0) {
          throw new ConflictException(
            `Cannot delete rack "${rack.name}" because its storage units contain active stock balances (${balanceCount}). Please transfer or issue stock before deleting.`,
          );
        }

        const txCount = await this.stockTransactionRepo.count({
          where: [
            { sourceBinId: In(binIds) },
            { destinationBinId: In(binIds) },
          ],
        });
        if (txCount > 0) {
          throw new ConflictException(
            `Cannot delete rack "${rack.name}" because historical stock transactions are linked to its storage units. Deactivate the rack instead.`,
          );
        }

        await this.binRepo.remove(bins);
      }
    }

    await this.rackRepo.remove(rack);
    return {
      success: true,
      message: `Rack "${rack.name}" deleted successfully.`,
    };
  }

  // ==========================================
  // 7. BINS
  // ==========================================
  async createBin(dto: CreateBinDto) {
    const rack = await this.rackRepo.findOneBy({ id: dto.rackId });
    if (!rack) {
      throw new NotFoundException(
        `Parent Rack with ID "${dto.rackId}" not found.`,
      );
    }

    const normalizedCode = dto.code.trim().toUpperCase();
    const trimmedName = dto.name.trim();

    const existingCode = await this.binRepo
      .createQueryBuilder('b')
      .where('b.rackId = :rackId', { rackId: dto.rackId })
      .andWhere('UPPER(b.code) = :code', { code: normalizedCode })
      .getOne();

    if (existingCode) {
      throw new ConflictException(
        `Bin code "${normalizedCode}" already exists in this Rack.`,
      );
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
      qb.andWhere('(b.name ILIKE :search OR b.code ILIKE :search)', {
        search: `%${search}%`,
      });
    }
    if (isActive !== undefined) {
      qb.andWhere('b.isActive = :isActive', { isActive });
    }

    qb.orderBy('b.code', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [data, total] = await qb.getManyAndCount();
    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
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
        throw new NotFoundException(
          `Parent Rack with ID "${dto.rackId}" not found.`,
        );
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
        throw new ConflictException(
          `Bin code "${normalizedCode}" already exists in this Rack.`,
        );
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

  async deleteBin(id: string) {
    const bin = await this.findBinById(id);

    const balanceCount = await this.stockBalanceRepo.count({
      where: { binId: id },
    });
    if (balanceCount > 0) {
      throw new ConflictException(
        `Cannot delete bin "${bin.name}" because it is referenced by ${balanceCount} stock balances. Deactivate it instead.`,
      );
    }

    const sourceTxCount = await this.stockTransactionRepo.count({
      where: { sourceBinId: id },
    });
    const destTxCount = await this.stockTransactionRepo.count({
      where: { destinationBinId: id },
    });

    if (sourceTxCount > 0 || destTxCount > 0) {
      throw new ConflictException(
        `Cannot delete bin "${bin.name}" because it is referenced by historical stock transactions. Deactivate it instead.`,
      );
    }

    await this.binRepo.remove(bin);
    return {
      success: true,
      message: `Bin "${bin.name}" deleted successfully.`,
    };
  }
}
