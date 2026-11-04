import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { MercIndentService } from './merc-indent.service.js';
import { InternalSecretGuard } from './guards/internal-secret.guard.js';
import { ReceiveMercIndentDto } from './dto/receive-merc-indent.dto.js';
import { IssueMercItemDto } from './dto/issue-merc-item.dto.js';
import { CreateMercProductDto } from './dto/create-merc-product.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../auth/enums/role.enum.js';

@Controller('api')
export class MercIndentController {
  constructor(private readonly mercIndentService: MercIndentService) {}

  @Post('internal/merc/indent-pending')
  @UseGuards(InternalSecretGuard)
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  async receiveIndentPending(@Body() dto: ReceiveMercIndentDto) {
    return this.mercIndentService.receiveMercIndent(dto);
  }

  @Get('merc-indents')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STORES, UserRole.ADMIN)
  async getAll() {
    return this.mercIndentService.getAll();
  }

  @Post('merc-indents/sync')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STORES, UserRole.ADMIN)
  async syncFromMerc() {
    return this.mercIndentService.syncFromMerc();
  }

  @Post('merc-indents/products/create-and-stock')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STORES, UserRole.ADMIN)
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  async createAndStockProduct(@Body() dto: CreateMercProductDto, @Req() req: any) {
    return this.mercIndentService.createAndStockProduct(dto, req.user);
  }

  @Get('merc-indents/:id/full-detail')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STORES, UserRole.ADMIN)
  async getFullDetail(@Param('id') id: string) {
    return this.mercIndentService.getFullDetail(id);
  }

  @Get('merc-indents/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STORES, UserRole.ADMIN)
  async getOne(@Param('id') id: string) {
    return this.mercIndentService.getOne(id);
  }

  @Get('merc-indents/:id/items/:itemId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STORES, UserRole.ADMIN)
  async getItemDetail(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.mercIndentService.getItemDetail(id, itemId);
  }

  @Post('merc-indents/:id/items/:itemId/issue')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STORES, UserRole.ADMIN)
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  async issueMercItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: IssueMercItemDto,
    @Req() req: any,
  ) {
    return this.mercIndentService.issueMercItem(id, itemId, dto, req.user);
  }
}

export default MercIndentController;
