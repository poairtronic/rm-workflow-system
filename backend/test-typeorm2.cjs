const { DataSource } = require('typeorm');
require('dotenv').config();

// We need to import the entities using absolute paths and .js
const path = require('path');
const entitiesPath = path.join(__dirname, 'src', '**', '*.entity.ts');

async function test() {
  const AppDataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    entities: [entitiesPath],
  });

  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository('SalesOrderComponent');
  
  const sc = await repo.findOne({
    where: { scNumber: 'SC-26-003' },
    relations: { rmRequest: { items: true } }
  });
  
  console.log(JSON.stringify(sc, null, 2));
  await AppDataSource.destroy();
}
test();
