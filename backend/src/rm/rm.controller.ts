import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import { RmService } from './rm.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../auth/enums/role.enum.js';
import { CreateRmDto, CreateRmItemDto, SubmitRmDto } from './dto/rm.dto.js';
import { StoresReviewRmDto } from './dto/stores-review.dto.js';
import { RmRequestStatus } from './entities/rm-request.entity.js';

@Controller('api/rm')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RmController {
  constructor(private readonly rmService: RmService) {}

  @Post()
  @Roles(UserRole.DESIGNER, UserRole.ADMIN)
  createRm(@Body() dto: CreateRmDto, @Req() req: any) {
    return this.rmService.createRm(dto, req.user.userId);
  }

  @Post(':id/items')
  @Roles(UserRole.DESIGNER, UserRole.ADMIN)
  addRmItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateRmItemDto,
  ) {
    return this.rmService.addRmItem(id, dto);
  }

  @Post(':id/submit')
  @Roles(UserRole.DESIGNER, UserRole.ADMIN)
  submitRm(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitRmDto,
  ) {
    return this.rmService.submitRm(id, dto);
  }

  @Post(':id/review')
  @Roles(UserRole.STORES, UserRole.ADMIN)
  reviewRm(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StoresReviewRmDto,
    @Req() req: any,
  ) {
    return this.rmService.reviewRm(id, dto, req.user.userId);
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
    @Query('scId') scId?: string,
    @Query('status') status?: RmRequestStatus,
  ) {
    return this.rmService.findAll({ scId, status });
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
    return this.rmService.findOne(id);
  }
}


