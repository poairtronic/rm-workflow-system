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
import { AdditionalRequestService } from './additional-request.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../auth/enums/role.enum.js';
import { CreateAdditionalRequestDto } from './dto/additional-request.dto.js';

@Controller('api/additional-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdditionalRequestController {
  constructor(
    private readonly additionalRequestService: AdditionalRequestService,
  ) {}

  @Post()
  @Roles(UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.ADMIN)
  createRequest(@Body() dto: CreateAdditionalRequestDto, @Req() req: any) {
    return this.additionalRequestService.createRequest(dto, req.user.sub);
  }

  @Get()
  @Roles(
    UserRole.ADMIN,
    UserRole.STORES,
    UserRole.PRODUCTION,
    UserRole.DESIGNER,
    UserRole.SENIOR_MANAGER,
    UserRole.GENERAL_MANAGER,
  )
  findAll(@Query('scId') scId?: string) {
    return this.additionalRequestService.findAll(scId);
  }

  @Get(':id')
  @Roles(
    UserRole.ADMIN,
    UserRole.STORES,
    UserRole.PRODUCTION,
    UserRole.DESIGNER,
    UserRole.SENIOR_MANAGER,
    UserRole.GENERAL_MANAGER,
  )
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.additionalRequestService.findOne(id);
  }
}

