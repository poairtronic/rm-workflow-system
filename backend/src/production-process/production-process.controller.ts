import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  ValidationPipe,
} from '@nestjs/common';
import { ProductionProcessService } from './production-process.service.js';
import { CreateProductionProcessDto } from './dto/create-production-process.dto.js';
import { UpdateProductionProcessDto } from './dto/update-production-process.dto.js';
import { GetProductionProcessFilterDto } from './dto/get-production-process-filter.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../auth/enums/role.enum.js';
import { ProductionProcess } from './entities/production-process.entity.js';

@Controller('api/production-processes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductionProcessController {
  constructor(
    private readonly productionProcessService: ProductionProcessService,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.STORES, UserRole.PRODUCTION)
  create(
    @Body() createDto: CreateProductionProcessDto,
  ): Promise<ProductionProcess> {
    return this.productionProcessService.create(createDto);
  }

  @Get()
  findAll(
    @Query(new ValidationPipe({ transform: true }))
    filterDto: GetProductionProcessFilterDto,
  ): Promise<ProductionProcess[]> {
    return this.productionProcessService.findAll(filterDto);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProductionProcess> {
    return this.productionProcessService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.STORES, UserRole.PRODUCTION)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateProductionProcessDto,
  ): Promise<ProductionProcess> {
    return this.productionProcessService.update(id, updateDto);
  }

  @Patch(':id/toggle-active')
  @Roles(UserRole.ADMIN, UserRole.STORES, UserRole.PRODUCTION)
  toggleActive(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProductionProcess> {
    return this.productionProcessService.toggleActive(id);
  }
}
