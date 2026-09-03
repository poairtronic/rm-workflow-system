const fs = require('fs');
const path = require('path');

const modules = [
  'users',
  'roles',
  'permissions',
  'customers',
  'po',
  'sc',
  'rm',
  'verification',
  'stores',
  'material-issue',
  'production',
  'material-movement',
  'additional-request',
  'notifications',
  'analytics',
  'audit',
];

function toPascalCase(str) {
  return str
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

function toCamelCase(str) {
  const p = toPascalCase(str);
  return p.charAt(0).toLowerCase() + p.slice(1);
}

const backendSrc = path.join(__dirname, '..', 'backend', 'src');

modules.forEach((mod) => {
  const modDir = path.join(backendSrc, mod);
  fs.mkdirSync(path.join(modDir, 'dto'), { recursive: true });
  fs.mkdirSync(path.join(modDir, 'entities'), { recursive: true });

  const pascal = toPascalCase(mod);
  const camel = toCamelCase(mod);

  // Service
  const serviceCode = `import { Injectable } from '@nestjs/common';

@Injectable()
export class ${pascal}Service {
  getStatus() {
    return { module: '${mod}', status: 'ready' };
  }
}
`;
  fs.writeFileSync(path.join(modDir, `${mod}.service.ts`), serviceCode);

  // Controller
  const controllerCode = `import { Controller, Get, UseGuards } from '@nestjs/common';
import { ${pascal}Service } from './${mod}.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@Controller('api/${mod}')
export class ${pascal}Controller {
  constructor(private readonly ${camel}Service: ${pascal}Service) {}

  @Get('status')
  getStatus() {
    return this.${camel}Service.getStatus();
  }
}
`;
  fs.writeFileSync(path.join(modDir, `${mod}.controller.ts`), controllerCode);

  // Module
  const moduleCode = `import { Module } from '@nestjs/common';
import { ${pascal}Controller } from './${mod}.controller.js';
import { ${pascal}Service } from './${mod}.service.js';

@Module({
  controllers: [${pascal}Controller],
  providers: [${pascal}Service],
  exports: [${pascal}Service],
})
export class ${pascal}Module {}
`;
  fs.writeFileSync(path.join(modDir, `${mod}.module.ts`), moduleCode);
});

console.log(`Successfully generated ${modules.length} backend modules with clean TypeScript.`);
