import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Request,
  NotImplementedException,
  Query,
  ValidationPipe,
} from '@nestjs/common';
import { InventoryService } from './inventory.service.js';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto.js';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto.js';
import { GetInventoryFilterDto } from './dto/get-inventory-filter.dto.js';
import { GetTransactionFilterDto } from './dto/get-transaction-filter.dto.js';
import { CreateStockTransactionDto } from './dto/create-stock-transaction.dto.js';
import { CreateStockInDto } from './dto/create-stock-in.dto.js';
import { CreateStockOutDto } from './dto/create-stock-out.dto.js';
import { CreateStockAdjustmentDto } from './dto/create-stock-adjustment.dto.js';
import { ReconciliationResultDto } from './dto/reconciliation-result.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../auth/enums/role.enum.js';

@Controller('api/inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post()
  @Roles(UserRole.STORES, UserRole.ADMIN)
  create(@Body() createDto: CreateInventoryItemDto) {
    return this.inventoryService.create(createDto);
  }

  @Get()
  @Roles(
    UserRole.STORES,
    UserRole.ADMIN,
    UserRole.DESIGNER,
    UserRole.SENIOR_MANAGER,
    UserRole.GENERAL_MANAGER,
  )
  findAll(@Query(new ValidationPipe({ transform: true })) filterDto: GetInventoryFilterDto) {
    return this.inventoryService.findAll(filterDto);
  }

  @Get('reconciliation')
  @Roles(UserRole.STORES, UserRole.ADMIN, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER)
  getReconciliation(): Promise<ReconciliationResultDto[]> {
    return this.inventoryService.getReconciliation();
  }

  @Get('reconciliation/workflow')
  @Roles(UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER)
  getWorkflowReconciliation() {
    return this.inventoryService.getWorkflowReconciliation();
  }

  @Get(':id')
  @Roles(
    UserRole.STORES,
    UserRole.ADMIN,
    UserRole.DESIGNER,
    UserRole.SENIOR_MANAGER,
    UserRole.GENERAL_MANAGER,
  )
  findOne(@Param('id') id: string) {
    return this.inventoryService.findOne(id);
  }

  @Get(':id/reconciliation')
  @Roles(UserRole.STORES, UserRole.ADMIN, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER)
  getSingleReconciliation(@Param('id') id: string): Promise<ReconciliationResultDto[]> {
    return this.inventoryService.getReconciliation(id);
  }

  @Patch(':id')
  @Roles(UserRole.STORES, UserRole.ADMIN)
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateInventoryItemDto,
  ) {
    return this.inventoryService.update(id, updateDto);
  }

  @Get(':id/stock')
  @Roles(
    UserRole.STORES,
    UserRole.ADMIN,
    UserRole.DESIGNER,
    UserRole.SENIOR_MANAGER,
    UserRole.GENERAL_MANAGER,
  )
  getStockBalance(@Param('id') id: string) {
    return this.inventoryService.getStockBalance(id);
  }

  @Get(':id/transactions')
  @Roles(UserRole.STORES, UserRole.ADMIN, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER)
  getTransactions(
    @Param('id') id: string,
    @Query(new ValidationPipe({ transform: true })) filterDto: GetTransactionFilterDto,
  ) {
    return this.inventoryService.getTransactions(id, filterDto);
  }

  @Post(':id/stock-in')
  @Roles(UserRole.STORES, UserRole.ADMIN)
  stockIn(
    @Param('id') id: string,
    @Body() dto: CreateStockInDto,
    @Request() req: any,
  ) {
    return this.inventoryService.stockIn(id, dto, req.user.sub);
  }

  @Post(':id/stock-out')
  @Roles(UserRole.STORES, UserRole.ADMIN)
  stockOut(
    @Param('id') id: string,
    @Body() dto: CreateStockOutDto,
    @Request() req: any,
  ) {
    return this.inventoryService.stockOut(id, dto, req.user.sub);
  }

  @Post(':id/adjustment')
  @Roles(UserRole.STORES, UserRole.ADMIN)
  stockAdjustment(
    @Param('id') id: string,
    @Body() dto: CreateStockAdjustmentDto,
    @Request() req: any,
  ) {
    return this.inventoryService.stockAdjustment(id, dto, req.user.sub);
  }

  @Post(':id/transactions')
  @Roles(UserRole.STORES, UserRole.ADMIN)
  addTransaction(
    @Param('id') _id: string,
    @Body() _transactionDto: CreateStockTransactionDto,
    @Request() _req: any,
  ) {
    // Unrestricted direct stock mutation is disabled in Phase 10.3 to enforce proper movement semantics.
    throw new NotImplementedException('Direct generic stock mutation is restricted. Use dedicated workflows (Phase 10.4+).');
  }
}
