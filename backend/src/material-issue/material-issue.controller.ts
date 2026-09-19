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
import { MaterialIssueService } from './material-issue.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../auth/enums/role.enum.js';
import { CreateMaterialIssueDto } from './dto/material-issue.dto.js';

@Controller('api/material-issues')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MaterialIssueController {
  constructor(private readonly materialIssueService: MaterialIssueService) {}

  @Post()
  @Roles(UserRole.STORES, UserRole.ADMIN)
  createIssue(@Body() dto: CreateMaterialIssueDto, @Req() req: any) {
    return this.materialIssueService.createIssue(dto, req.user.userId);
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
    return this.materialIssueService.findAll(scId);
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
    return this.materialIssueService.findOne(id);
  }
}
