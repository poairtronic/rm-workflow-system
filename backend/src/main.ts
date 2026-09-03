import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule);
    app.enableCors({
      origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
      credentials: true,
    });
    const port = process.env.PORT ?? 3000;
    await app.listen(port);
    console.log(`[RMRIT Backend] Running on http://localhost:${port}`);
  } catch (err: any) {
    console.error('[RMRIT Backend] Startup exception:', err?.message || err);
  }
}
await bootstrap();
