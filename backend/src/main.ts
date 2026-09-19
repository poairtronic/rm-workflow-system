import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/http-exception.filter.js';
async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule);
    app.enableCors({
      origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
      credentials: true,
    });
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));
    app.useGlobalFilters(new AllExceptionsFilter());
    const port = process.env.PORT ?? 3000;
    await app.listen(port);
    console.log(`[RMRIT Backend] Running on http://localhost:${port}`);
  } catch (err: any) {
    console.error('[RMRIT Backend] Startup exception:', err?.message || err);
  }
}
await bootstrap();
