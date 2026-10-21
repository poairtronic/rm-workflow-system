import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ConsumablesService } from './consumables.service.js';
import { CreateConsumableRequestDto } from './dto/create-consumable-request.dto.js';
import { ReceiveConsumablePurchaseDto } from './dto/receive-consumable-purchase.dto.js';
import { IssueConsumableToProductionDto } from './dto/issue-to-production.dto.js';
import { PrintPrDto } from './dto/print-pr.dto.js';
import { QueryConsumableItemsDto } from './dto/query-consumables.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../auth/enums/role.enum.js';

@ApiTags('Consumables Management')
@ApiBearerAuth('JWT-auth')
@Controller('api/consumables')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConsumablesController {
  constructor(private readonly consumablesService: ConsumablesService) {}

  /**
   * Phase 24.2.1: Submit a new consumable request document with line items.
   * Allowed roles: PRODUCTION, STORES, ADMIN, SENIOR_MANAGER, GENERAL_MANAGER
   */
  @Post('requests')
  @Roles(
    UserRole.PRODUCTION,
    UserRole.STORES,
    UserRole.ADMIN,
    UserRole.SENIOR_MANAGER,
    UserRole.GENERAL_MANAGER,
  )
  @ApiOperation({ summary: 'Submit a new multi-line consumable request document' })
  async createRequest(
    @Body() dto: CreateConsumableRequestDto,
    @Req() req: any,
  ) {
    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    return this.consumablesService.createRequest(dto, userId);
  }

  /**
   * Get all active products with aggregated live stock in warehouse bins.
   */
  @Get('catalog-with-stock')
  @Roles(
    UserRole.PRODUCTION,
    UserRole.STORES,
    UserRole.ADMIN,
    UserRole.SENIOR_MANAGER,
    UserRole.GENERAL_MANAGER,
    UserRole.DESIGNER,
  )
  @ApiOperation({ summary: 'Get active products with aggregated current warehouse stock' })
  async getCatalogWithStock() {
    return this.consumablesService.getCatalogWithStock();
  }

  /**
   * List all consumable requests with header details and line item counts.
   */
  @Get('requests')
  @Roles(
    UserRole.PRODUCTION,
    UserRole.STORES,
    UserRole.ADMIN,
    UserRole.SENIOR_MANAGER,
    UserRole.GENERAL_MANAGER,
    UserRole.DESIGNER,
  )
  @ApiOperation({ summary: 'List all consumable requests' })
  async findAllRequests() {
    return this.consumablesService.findAllRequests();
  }

  /**
   * Get single consumable request with full item relations.
   */
  @Get('requests/:id')
  @Roles(
    UserRole.PRODUCTION,
    UserRole.STORES,
    UserRole.ADMIN,
    UserRole.SENIOR_MANAGER,
    UserRole.GENERAL_MANAGER,
    UserRole.DESIGNER,
  )
  @ApiOperation({ summary: 'Get single consumable request by ID' })
  async findOneRequest(@Param('id', ParseUUIDPipe) id: string) {
    return this.consumablesService.findOneRequest(id);
  }

  /**
   * Filter and list line items across Track A (In-Stock) & Track B (Purchase).
   */
  @Get('line-items')
  @Roles(
    UserRole.PRODUCTION,
    UserRole.STORES,
    UserRole.ADMIN,
    UserRole.SENIOR_MANAGER,
    UserRole.GENERAL_MANAGER,
    UserRole.DESIGNER,
  )
  @ApiOperation({ summary: 'List and filter consumable line items (In-Stock vs Purchase Queue)' })
  async findAllLineItems(@Query() query: QueryConsumableItemsDto) {
    return this.consumablesService.findAllLineItems(query);
  }

  /**
   * Get single consumable line item by ID.
   */
  @Get('line-items/:id')
  @Roles(
    UserRole.PRODUCTION,
    UserRole.STORES,
    UserRole.ADMIN,
    UserRole.SENIOR_MANAGER,
    UserRole.GENERAL_MANAGER,
    UserRole.DESIGNER,
  )
  @ApiOperation({ summary: 'Get single consumable line item by ID' })
  async findOneItem(@Param('id', ParseUUIDPipe) id: string) {
    return this.consumablesService.findOneItem(id);
  }

  /**
   * Get all active warehouse bins with complete location hierarchy.
   */
  @Get('warehouse-bins')
  @Roles(
    UserRole.PRODUCTION,
    UserRole.STORES,
    UserRole.ADMIN,
    UserRole.SENIOR_MANAGER,
    UserRole.GENERAL_MANAGER,
    UserRole.DESIGNER,
  )
  @ApiOperation({ summary: 'Get all active warehouse bins for storekeeper stock routing' })
  async getAllWarehouseBins() {
    return this.consumablesService.getAllWarehouseBins();
  }

  /**
   * Get active warehouse bins holding stock for a product, sorted by quantity descending.
   */
  @Get('products/:productId/stock-bins')
  @Roles(
    UserRole.PRODUCTION,
    UserRole.STORES,
    UserRole.ADMIN,
    UserRole.SENIOR_MANAGER,
    UserRole.GENERAL_MANAGER,
    UserRole.DESIGNER,
  )
  @ApiOperation({ summary: 'Get active warehouse bins containing stock for a product' })
  async getProductStockBins(@Param('productId', ParseUUIDPipe) productId: string) {
    return this.consumablesService.getProductStockBins(productId);
  }

  /**
   * Phase 24.2.2: Select OPEN line items and print PR slip (assigns sequential PR number starting at 151).
   * Allowed roles: STORES, ADMIN, GENERAL_MANAGER
   */
  @Post('purchase/print-pr')
  @Roles(UserRole.STORES, UserRole.ADMIN, UserRole.GENERAL_MANAGER)
  @ApiOperation({ summary: 'Assign sequential PR Number (starts at 151) and mark items PURCHASE_REQUESTED' })
  async printPurchaseRequisition(
    @Body() dto: PrintPrDto,
    @Req() req: any,
  ) {
    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    return this.consumablesService.printPurchaseRequisition(dto, userId);
  }

  /**
   * Phase 24.2.3: Stores receives purchased item into bin with real quantity,
   * atomic STOCK_IN, and optional immediate auto-issue to production.
   * Allowed roles: STORES, ADMIN, GENERAL_MANAGER
   */
  @Post('purchase/receive')
  @Roles(UserRole.STORES, UserRole.ADMIN, UserRole.GENERAL_MANAGER)
  @ApiOperation({ summary: 'Receive purchased item into bin with editable real quantity & atomic STOCK_IN' })
  async receivePurchase(
    @Body() dto: ReceiveConsumablePurchaseDto,
    @Req() req: any,
  ) {
    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    return this.consumablesService.receivePurchase(dto, userId);
  }

  /**
   * Phase 24.2.4: Stores issues an in-stock or received consumable to production.
   * Allowed roles: STORES, ADMIN, GENERAL_MANAGER
   */
  @Post('line-items/:id/issue-to-production')
  @Roles(UserRole.STORES, UserRole.ADMIN, UserRole.GENERAL_MANAGER)
  @ApiOperation({ summary: 'Issue in-stock or received consumable to production with atomic STOCK_OUT' })
  async issueToProduction(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: IssueConsumableToProductionDto,
    @Req() req: any,
  ) {
    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    return this.consumablesService.issueToProduction(id, dto, userId);
  }

  /**
   * Phase 24.2.5: Closed loop - Production confirms receipt on shop floor.
   * Allowed roles: PRODUCTION, ADMIN, GENERAL_MANAGER
   */
  @Patch('line-items/:id/production-receive')
  @Roles(UserRole.PRODUCTION, UserRole.ADMIN, UserRole.GENERAL_MANAGER)
  @ApiOperation({ summary: 'Production operator explicitly confirms receipt of consumable on shop floor' })
  async confirmProductionReceipt(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ) {
    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    return this.consumablesService.confirmProductionReceipt(id, userId);
  }
}

