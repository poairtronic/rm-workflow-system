import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ScService } from './sc.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../auth/enums/role.enum.js';
import { CreateScDto, CompleteScDto, CloseScDto } from './dto/sc.dto.js';
import { ScStatus } from './entities/sc.entity.js';

@Controller('api/sc')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ScController {
  constructor(private readonly scService: ScService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.DESIGNER, UserRole.STORES)
  createSc(@Body() dto: CreateScDto) {
    return this.scService.createSc(dto);
  }

  @Get()
  @Roles(
    UserRole.ADMIN,
    UserRole.DESIGNER,
    UserRole.STORES,
    UserRole.PRODUCTION,
    UserRole.SENIOR_MANAGER,
    UserRole.GENERAL_MANAGER,
  )
  findAll(
    @Query('poId') poId?: string,
    @Query('scNumber') scNumber?: string,
    @Query('status') status?: ScStatus,
    @Query('search') search?: string,
  ) {
    return this.scService.findAll({ poId, scNumber, status, search });
  }

  @Get(':id')
  @Roles(
    UserRole.ADMIN,
    UserRole.DESIGNER,
    UserRole.STORES,
    UserRole.PRODUCTION,
    UserRole.SENIOR_MANAGER,
    UserRole.GENERAL_MANAGER,
  )
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.scService.findOne(id);
  }

  @Post(':id/complete')
  @Roles(UserRole.PRODUCTION, UserRole.ADMIN)
  completeSc(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteScDto,
    @Req() req: any,
  ) {
    return this.scService.completeSc(id, req.user.userId, dto);
  }

  @Post(':id/close')
  @Roles(UserRole.STORES, UserRole.PRODUCTION, UserRole.ADMIN)
  closeSc(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloseScDto,
    @Req() req: any,
  ) {
    return this.scService.closeSc(id, req.user.userId, dto);
  }
}
