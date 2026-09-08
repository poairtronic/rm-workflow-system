import { DataSource } from 'typeorm';
import { InventoryItem } from '../inventory/entities/inventory-item.entity.js';
import { StockBalance } from '../inventory/entities/stock-balance.entity.js';
import { AppDataSource } from '../config/data-source.js';
import crypto from 'crypto';

async function seedInventory() {
  await AppDataSource.initialize();
  console.log('[Seed] Database connected.');

  const itemRepo = AppDataSource.getRepository(InventoryItem);
  const balanceRepo = AppDataSource.getRepository(StockBalance);

  const testItems = [
    {
      id: crypto.randomUUID(),
      material: 'OHNS',
      materialType: 'Rod',
      grade: 'D3',
      size: '25 Dia',
      unit: 'KG',
      minimumStockLevel: 50,
      isActive: true,
    },
    {
      id: crypto.randomUUID(),
      material: 'MS',
      materialType: 'Plate',
      grade: 'IS2062',
      size: '10mm',
      unit: 'KG',
      minimumStockLevel: 200,
      isActive: true,
    },
    {
      id: crypto.randomUUID(),
      material: 'HSS',
      materialType: 'Block',
      grade: 'M2',
      size: '100x100x50',
      unit: 'NOS',
      minimumStockLevel: 10,
      isActive: true,
    }
  ];

  for (const itemData of testItems) {
    const existing = await itemRepo.findOne({
      where: {
        material: itemData.material,
        materialType: itemData.materialType,
        grade: itemData.grade,
        size: itemData.size
      }
    });

    if (!existing) {
      const item = itemRepo.create(itemData);
      await itemRepo.save(item);

      const balance = balanceRepo.create({
        inventoryItemId: item.id,
        currentQuantity: Math.floor(Math.random() * 100) + 10,
      });
      await balanceRepo.save(balance);

      console.log(`[Seed] Added item: ${itemData.material} ${itemData.size}`);
    } else {
      console.log(`[Seed] Item already exists: ${itemData.material} ${itemData.size}`);
    }
  }

  await AppDataSource.destroy();
  console.log('[Seed] Seeding complete.');
}

seedInventory().catch(console.error);
