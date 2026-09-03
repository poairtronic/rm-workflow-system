import { AppDataSource } from '../../backend/src/config/data-source.js';
import { Role } from '../../backend/src/roles/entities/role.entity.js';
import { User } from '../../backend/src/users/entities/user.entity.js';
import { Customer } from '../../backend/src/customers/entities/customer.entity.js';
import { PurchaseOrder } from '../../backend/src/po/entities/po.entity.js';
import {
  SalesOrderComponent,
  ScStatus,
} from '../../backend/src/sc/entities/sc.entity.js';
import {
  RmRequest,
  FormType,
  RmRequestStatus,
} from '../../backend/src/rm/entities/rm-request.entity.js';
import { RmItem } from '../../backend/src/rm/entities/rm-item.entity.js';
import { SEED_ROLES, getSeedUsers } from '../seeds/01-roles-and-users.seed.js';
import { SEED_CUSTOMERS, SEED_PURCHASE_ORDERS } from '../seeds/02-sample-po-sc.seed.js';

export async function runSeeds() {
  console.log('[RMRIT Database Seed] Initializing DataSource connection...');
  await AppDataSource.initialize();
  console.log('[RMRIT Database Seed] Connected successfully to PostgreSQL.');

  const roleRepo = AppDataSource.getRepository(Role);
  const userRepo = AppDataSource.getRepository(User);
  const customerRepo = AppDataSource.getRepository(Customer);
  const poRepo = AppDataSource.getRepository(PurchaseOrder);
  const scRepo = AppDataSource.getRepository(SalesOrderComponent);
  const rmReqRepo = AppDataSource.getRepository(RmRequest);
  const rmItemRepo = AppDataSource.getRepository(RmItem);

  // 1. Seed Roles
  console.log('[RMRIT Database Seed] Seeding roles...');
  const roleMap = new Map<string, Role>();
  for (const r of SEED_ROLES) {
    let existing = await roleRepo.findOne({ where: { name: r.name } });
    if (!existing) {
      existing = roleRepo.create(r);
      await roleRepo.save(existing);
    }
    roleMap.set(r.name, existing);
  }

  // 2. Seed Users
  console.log('[RMRIT Database Seed] Seeding users...');
  const users = await getSeedUsers();
  const userMap = new Map<string, User>();
  for (const u of users) {
    let existing = await userRepo.findOne({ where: { email: u.email } });
    const targetRole = roleMap.get(u.roleName);
    if (!targetRole) continue;

    if (!existing) {
      existing = userRepo.create({
        name: u.name,
        email: u.email,
        passwordHash: u.passwordHash,
        role: targetRole,
        department: u.department,
      });
      await userRepo.save(existing);
    }
    userMap.set(u.email, existing);
  }

  // 3. Seed Customers
  console.log('[RMRIT Database Seed] Seeding customers...');
  const customerMap = new Map<string, Customer>();
  for (const c of SEED_CUSTOMERS) {
    let existing = await customerRepo.findOne({ where: { code: c.code } });
    if (!existing) {
      existing = customerRepo.create(c);
      await customerRepo.save(existing);
    }
    customerMap.set(c.code, existing);
  }

  // 4. Seed Purchase Orders, SCs, and RM Lists
  console.log('[RMRIT Database Seed] Seeding PO, SC, and RM Lists...');
  const designerUser =
    userMap.get('designer@airtronic.com') || Array.from(userMap.values())[0];

  for (const poData of SEED_PURCHASE_ORDERS) {
    const customer = customerMap.get(poData.customerCode);
    if (!customer) continue;

    let po = await poRepo.findOne({ where: { poNumber: poData.poNumber } });
    if (!po) {
      po = poRepo.create({
        poNumber: poData.poNumber,
        customer,
        referenceDate: new Date(poData.referenceDate),
        remarks: poData.remarks,
      });
      await poRepo.save(po);
    }

    for (const scData of poData.components) {
      let sc = await scRepo.findOne({
        where: { scNumber: scData.scNumber, poId: po.id },
      });
      if (!sc) {
        sc = scRepo.create({
          scNumber: scData.scNumber,
          purchaseOrder: po,
          productName: scData.productName,
          drawingNumber: scData.drawingNumber,
          targetQuantity: scData.targetQuantity,
          status: scData.status as ScStatus,
        });
        await scRepo.save(sc);
      }

      let rmReq = await rmReqRepo.findOne({ where: { scId: sc.id } });
      if (!rmReq) {
        rmReq = rmReqRepo.create({
          salesOrderComponent: sc,
          createdBy: designerUser,
          formType: FormType.SC,
          status: RmRequestStatus.SUBMITTED,
          submittedAt: new Date(),
        });
        await rmReqRepo.save(rmReq);

        for (const itemData of scData.rmItems) {
          const rmItem = rmItemRepo.create({
            rmRequest: rmReq,
            scId: sc.id,
            ...itemData,
          });
          await rmItemRepo.save(rmItem);
        }
      }
    }
  }

  console.log('[RMRIT Database Seed] ✓ Database seeding complete.');
  await AppDataSource.destroy();
}

if (process.argv[1]?.includes('run-seed')) {
  runSeeds().catch((err) => {
    console.error('[RMRIT Database Seed] Error seeding database:', err);
    process.exit(1);
  });
}
