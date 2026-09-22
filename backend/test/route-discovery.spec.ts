import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module.js';
import * as fs from 'fs';
import * as path from 'path';

describe('Route Discovery', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('discovers all registered HTTP routes', () => {
    const expressApp = app.getHttpAdapter().getInstance();
    let router = expressApp._router || expressApp.router;

    const routes: Array<{ method: string; path: string }> = [];

    if (!router && expressApp._events?.request) {
      router = expressApp._events.request._router || expressApp._events.request.router;
    }

    if (router && router.stack) {
      router.stack.forEach((layer: any) => {
        if (layer.route) {
          const path = layer.route.path;
          const methods = Object.keys(layer.route.methods)
            .filter((m) => layer.route.methods[m])
            .map((m) => m.toUpperCase());
          methods.forEach((method) => {
            routes.push({ method, path });
          });
        }
      });
    }

    // Also extract via NestJS Discovery if express router stack was empty
    if (routes.length === 0) {
      console.log('Router stack was empty, inspecting router keys:', Object.keys(expressApp));
      // In Nest 11/12 express 5, router stack is in expressApp.router.stack or expressApp._router
    }

    console.log(`[DISCOVERY_RESULT] TOTAL_ROUTES: ${routes.length}`);

    // Sort routes by path then method
    routes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

    console.log(`[DISCOVERY_RESULT] TOTAL_ROUTES: ${routes.length}`);
    fs.writeFileSync(
      path.join(process.cwd(), 'discovered-routes.json'),
      JSON.stringify(routes, null, 2),
      'utf8'
    );

    expect(routes.length).toBeGreaterThan(0);
  });
});
