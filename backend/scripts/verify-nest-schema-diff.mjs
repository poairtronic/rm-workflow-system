import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../dist/app.module.js';
import { DataSource } from 'typeorm';

async function verifySchemaDiff() {
  process.env.NODE_ENV = 'production';
  process.env.EMAIL_PROVIDER_TYPE = 'test';
  process.env.TYPEORM_SYNC = 'false';

  console.log('Booting Nest application to inspect live TypeORM schema diff...');
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  const ds = app.get(DataSource);

  console.log('Generating schema diff vs database...');
  const schemaBuilder = ds.driver.createSchemaBuilder();
  const sqlInMemory = await schemaBuilder.log();

  console.log('\n--- TYPEORM SCHEMA DIFF RESULTS ---');
  console.log(`Total Up Queries: ${sqlInMemory.upQueries.length}`);
  console.log(`Total Down Queries: ${sqlInMemory.downQueries.length}`);

  const consumableDiff = sqlInMemory.upQueries.filter((q) => {
    const query = typeof q === 'string' ? q : q.query;
    return query.toLowerCase().includes('consumable');
  });

  console.log(`\nConsumables-Specific Schema Diff Count: ${consumableDiff.length}`);
  if (consumableDiff.length > 0) {
    console.log('Consumable Diff Queries:');
    consumableDiff.forEach((q, i) => {
      console.log(`${i + 1}: ${typeof q === 'string' ? q : q.query}`);
    });
  } else {
    console.log('✓ PASS: Exactly ZERO schema diff for all consumable entities!');
  }

  await app.close();
  process.exit(consumableDiff.length === 0 ? 0 : 1);
}

verifySchemaDiff().catch((err) => {
  console.error('Schema diff check failed:', err);
  process.exit(1);
});
