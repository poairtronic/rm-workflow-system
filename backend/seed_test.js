import { DataSource } from 'typeorm';

const AppDataSource = new DataSource({
  type: 'postgres',
  url: 'postgresql://neondb_owner:npg_qGQp4JTMa7vC@ep-still-bread-b5iszknm-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require',
  entities: [
    'src/**/*.entity.ts',
    'src/**/*.entity.js'
  ],
  synchronize: false,
});

async function test() {
  try {
    await AppDataSource.initialize();
    console.log("Connected to DB");

    const sc = await AppDataSource.getRepository('SalesOrderComponent').findOne({
      where: { scNumber: 'SC-TEST-3-1463' },
      relations: { rmRequest: { items: true } }
    });
    console.log(JSON.stringify(sc, null, 2));

  } catch(e) {
    console.error(e);
  } finally {
    await AppDataSource.destroy();
  }
}
test();
