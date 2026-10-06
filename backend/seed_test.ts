import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module.js';
import { ScService } from './src/sc/sc.service.js';

async function bootstrap() {
  process.env.NODE_ENV = 'development';
  // Use the remote neon db
  process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_qGQp4JTMa7vC@ep-still-bread-b5iszknm-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require';
  
  const app = await NestFactory.createApplicationContext(AppModule);
  const scService = app.get(ScService);

  try {
    const sc = await scService.findOne('4318565a-9fb7-4235-94dd-b9937cb209fb');
    console.log("SC Object from service:", JSON.stringify(sc, null, 2));
  } catch(e) {
    console.error(e);
  }

  await app.close();
}
bootstrap();
