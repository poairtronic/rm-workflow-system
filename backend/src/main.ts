import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/http-exception.filter.js';
import { IoAdapter } from '@nestjs/platform-socket.io';

process.on('unhandledRejection', (reason) => {
  console.error('[RMRIT Backend] Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[RMRIT Backend] Uncaught Exception:', err);
});

// Zero-dependency recursive XSS & String Trimmer
function sanitizePayload(obj: any): any {
  if (typeof obj === 'string') {
    return obj
      .trim()
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/javascript\s*:/gi, '');
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizePayload);
  }
  if (obj !== null && typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      obj[key] = sanitizePayload(obj[key]);
    }
  }
  return obj;
}

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule);

    // Trust proxy for accurate client IP resolution behind reverse proxies (Render)
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.set('trust proxy', 1);

    // Security headers via Helmet (CSP disabled to allow API-first & future Swagger UI)
    app.use(
      helmet({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false,
      }),
    );

    // HTTP payload compression (threshold: 0 ensures all responses are compressed)
    app.use(
      compression({
        threshold: 0,
        level: 6,
      }),
    );

    // Global recursive XSS sanitization & string trimming on request bodies
    app.use((req: any, _res: any, next: () => void) => {
      if (req.body && typeof req.body === 'object') {
        req.body = sanitizePayload(req.body);
      }
      next();
    });

    // Parse allowed origins flexibly
    const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
      .split(',')
      .map((o) => o.trim());

    app.enableCors({
      origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        // Allow requests with no origin (like mobile apps, curl, or server-to-server) or matching origins / *.onrender.com
        if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.onrender.com')) {
          callback(null, true);
        } else {
          callback(new Error(`Origin ${origin} not allowed by CORS policy`));
        }
      },
      credentials: true,
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useWebSocketAdapter(new IoAdapter(app));

    // Interactive OpenAPI / Swagger UI
    const swaggerConfig = new DocumentBuilder()
      .setTitle('RMRIT — Manufacturing & Traceability API')
      .setDescription(
        'Raw-Material Requirements & Inventory Traceability System REST API with Bearer JWT security.',
      )
      .setVersion('1.0.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'Paste your Bearer JWT token obtained from /api/auth/login',
          in: 'header',
        },
        'JWT-auth',
      )
      .addSecurityRequirements('JWT-auth') // Injects Bearer auth into all 29 controllers automatically
      .addTag('Authentication', 'Login, profile, roles, and dev tokens')
      .addTag('Master Data', 'Warehouses, locations, racks, bins, categories, and products')
      .addTag('Subcontracting (SC)', 'SC lifecycle, PO associations, and document attachments')
      .addTag('Raw Materials (RM)', 'RM specifications, BOM calculations, and requisitions')
      .addTag('Material Issuance', 'Stores stock allocation, partial issues, and slips')
      .addTag('Production', 'Shop-floor receipts, consumption, scrap, and returns')
      .addTag('Delivery Challans', 'Type 1 process dispatch and Type 2 general inventory')
      .addTag('Traceability & Reports', 'End-to-end SC/PO history, audit ledgers, and metrics')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'none',
        filter: true,
      },
    });

    const port = process.env.PORT ?? 3000;
    await app.listen(port, '0.0.0.0');
    console.log(`[RMRIT Backend] Running on http://0.0.0.0:${port}`);
    console.log(`[RMRIT Swagger] Interactive API docs available at http://localhost:${port}/api/docs`);
  } catch (err: any) {
    console.error('[RMRIT Backend] Startup exception:', err?.message || err);
  }
}
await bootstrap();

