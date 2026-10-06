const { DataSource } = require('typeorm');
require('dotenv').config();

const { SalesOrderComponent } = require('./src/sc/entities/sc.entity.js');
const { RmRequest } = require('./src/rm/entities/rm-request.entity.js');
const { RmItem } = require('./src/rm/entities/rm-item.entity.js');

async function test() {
  const AppDataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    entities: [
      __dirname + '/src/**/*.entity.{js,ts}'
    ],
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
