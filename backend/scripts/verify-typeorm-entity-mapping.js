import { DataSource } from 'typeorm';
import { RefreshToken } from '../dist/auth/entities/refresh-token.entity.js';
import { User } from '../dist/users/entities/user.entity.js';
import { Role } from '../dist/roles/entities/role.entity.js';
import 'dotenv/config';

async function verifyTypeOrmMapping() {
  console.log('--- TEST 5: TYPEORM ENTITY METADATA & REPOSITORY TEST ---');

  const dbUrl = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
  const isSsl = dbUrl.includes('sslmode=require') || process.env.NODE_ENV === 'production';

  const testDs = new DataSource({
    type: 'postgres',
    url: dbUrl,
    entities: [RefreshToken, User, Role],
    ssl: isSsl ? { rejectUnauthorized: false } : false,
    synchronize: false,
  });

  await testDs.initialize();
  console.log('Test DataSource initialized successfully.');

  const repo = testDs.getRepository(RefreshToken);
  console.log('Successfully retrieved RefreshToken repository.');

  const metadata = repo.metadata;
  console.log(`Table Name in TypeORM Metadata: ${metadata.tableName}`);
  console.log(`Columns registered in TypeORM: ${metadata.columns.map(c => c.propertyName).join(', ')}`);
  
  const count = await repo.count();
  console.log(`Current RefreshToken record count: ${count}`);

  const hasUserIdCol = metadata.columns.some(c => c.propertyName === 'userId');
  const hasTokenHashCol = metadata.columns.some(c => c.propertyName === 'tokenHash');
  const hasExpiresAtCol = metadata.columns.some(c => c.propertyName === 'expiresAt');
  const hasCascade = metadata.foreignKeys.some(fk => fk.onDelete === 'CASCADE');

  console.log('Entity Property Checks:');
  console.log(` - userId mapped: ${hasUserIdCol}`);
  console.log(` - tokenHash mapped: ${hasTokenHashCol}`);
  console.log(` - expiresAt mapped: ${hasExpiresAtCol}`);
  console.log(` - ON DELETE CASCADE configured: ${hasCascade}`);

  if (hasUserIdCol && hasTokenHashCol && hasExpiresAtCol && hasCascade) {
    console.log('✓ PASS: TypeORM RefreshToken entity metadata is valid and fully registered.');
  } else {
    console.error('✗ FAIL: TypeORM metadata mismatch.');
    process.exit(1);
  }

  await testDs.destroy();
}

verifyTypeOrmMapping().catch(err => {
  console.error('TypeORM verification failed:', err);
  process.exit(1);
});
