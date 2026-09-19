import { Controller, Get, Post, Body, Patch, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { PoService } from './po.service.js';
import { CreatePoDto } from './dto/create-po.dto.js';
import { UpdatePoDto } from './dto/update-po.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../auth/enums/role.enum.js';

@Controller('api/po')
export class PoController {
  constructor(private readonly poService: PoService) {}

  @Get('status')
  getStatus() {
    return this.poService.getStatus();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  @Roles(UserRole.ADMIN, UserRole.STORES)
  create(@Body() createPoDto: CreatePoDto) {
    return this.poService.create(createPoDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get()
  @Roles(UserRole.ADMIN, UserRole.STORES, UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER)
  findAll() {
    return this.poService.findAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.STORES, UserRole.PRODUCTION, UserRole.DESIGNER, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.poService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.STORES)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updatePoDto: UpdatePoDto) {
    return this.poService.update(id, updatePoDto);
  }
}
