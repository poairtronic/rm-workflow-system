import fs from 'fs';

const pkg = JSON.parse(fs.readFileSync('backend/package.json', 'utf8'));

const files = [
  'backend/src/consumables/consumables.service.ts',
  'backend/src/consumables/consumables.controller.ts',
  'backend/src/consumables/consumables-batch-notification.service.ts',
  'backend/src/consumables/entities/consumable-request.entity.ts',
  'backend/src/consumables/entities/consumable-request-item.entity.ts',
  'backend/src/consumables/dto/bulk-approve-consumables.dto.ts',
  'backend/src/consumables/dto/bulk-reject-consumables.dto.ts',
  'backend/src/consumables/dto/create-consumable-request.dto.ts',
  'backend/src/consumables/dto/query-consumables.dto.ts',
  'backend/src/consumables/dto/query-consumable-approvals.dto.ts',
  'backend/src/email/constants/email-priorities.ts',
  'backend/src/email/template.service.ts',
  'backend/src/email/email-queue.service.ts',
  'backend/src/notifications/communication.service.ts',
  'backend/src/notifications/notification-preference.service.ts',
];

const importedPackages = new Set();
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const importLines = content.match(/import\s+(?!type\s+)[^;]+from\s+['"][^'"]+['"]/g) || [];
  for (const line of importLines) {
    const match = line.match(/from\s+['"]([^'"]+)['"]/);
    if (match && !match[1].startsWith('.') && !match[1].startsWith('/')) {
      const parts = match[1].split('/');
      const pkgName = match[1].startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
      if (pkgName !== 'crypto' && pkgName !== 'path' && pkgName !== 'fs' && pkgName !== 'url' && pkgName !== 'node:dns') {
        importedPackages.add(pkgName);
      }
    }
  }
}

console.log('--- PACKAGES IMPORTED BY NEW/MODIFIED CONSUMABLES APPROVAL CODE ---');
let hasDevDep = false;
for (const pkgName of [...importedPackages].sort()) {
  const isDep = pkg.dependencies && pkg.dependencies[pkgName];
  const isDev = pkg.devDependencies && pkg.devDependencies[pkgName];
  console.log(`- ${pkgName}: ${isDep ? 'dependencies (' + isDep + ')' : (isDev ? 'WARNING devDependencies (' + isDev + ')' : 'MISSING')}`);
  if (!isDep && isDev) hasDevDep = true;
}
if (!hasDevDep) {
  console.log('\nPASS: All imported packages are in dependencies!');
} else {
  console.log('\nFAIL: Some imported packages are in devDependencies!');
}
