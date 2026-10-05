const fs = require('fs');

// 1. Service
let svc = fs.readFileSync('backend/src/inventory/inventory.service.ts', 'utf8');

const newMethod = `
  async getBalancesByProduct(productId: string) {
    const balances = await this.stockBalanceRepository
      .createQueryBuilder('sb')
      .leftJoinAndSelect('sb.bin', 'bin')
      .leftJoinAndSelect('bin.rack', 'rack')
      .leftJoinAndSelect('rack.location', 'location')
      .leftJoinAndSelect('location.warehouse', 'warehouse')
      .where('sb.product_id = :productId', { productId })
      .andWhere('sb.current_quantity > 0')
      .getMany();

    return balances.map(b => ({
      binId: b.binId,
      binCode: b.bin?.code,
      warehouseName: b.bin?.rack?.location?.warehouse?.name || 'Unknown',
      productId: b.productId,
      currentQuantity: Number(b.currentQuantity)
    }));
  }

  async findAll(`;

svc = svc.replace(/async findAll\(/, newMethod);
fs.writeFileSync('backend/src/inventory/inventory.service.ts', svc);

// 2. Controller
let ctl = fs.readFileSync('backend/src/inventory/inventory.controller.ts', 'utf8');

const newEndpoint = `
  @Get('balances')
  @Roles(
    UserRole.STORES,
    UserRole.ADMIN,
    UserRole.DESIGNER,
    UserRole.SENIOR_MANAGER,
    UserRole.GENERAL_MANAGER,
  )
  getBalancesByProduct(@Query('productId', ParseUUIDPipe) productId: string) {
    return this.inventoryService.getBalancesByProduct(productId);
  }

  @Get(':id')`;

ctl = ctl.replace(/@Get\(':id'\)/, newEndpoint);
fs.writeFileSync('backend/src/inventory/inventory.controller.ts', ctl);
