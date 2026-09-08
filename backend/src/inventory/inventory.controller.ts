import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { InventoryService } from './inventory.service.js';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto.js';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto.js';
import { CreateStockTransactionDto } from './dto/create-stock-transaction.dto.js';
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
  findAll() {
    return this.inventoryService.findAll();
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
  getTransactions(@Param('id') id: string) {
    return this.inventoryService.getTransactions(id);
  }

  @Post(':id/transactions')
  @Roles(UserRole.STORES, UserRole.ADMIN)
  addTransaction(
    @Param('id') id: string,
    @Body() transactionDto: CreateStockTransactionDto,
    @Request() req: any,
  ) {
    // req.user contains the authenticated user populated by JwtAuthGuard
    return this.inventoryService.addStockTransaction(
      id,
      transactionDto,
      req.user.sub,
    );
  }
}
