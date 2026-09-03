/**
 * Database Seed Runner Script Placeholder
 * To be connected to DataSource during the Database Design phase.
 */

import { INITIAL_PERSONA_USERS } from '../seeds/sample-users.seed.js';

export async function runSeeds() {
  console.log('[RMRIT Database] Prepared initial personas for seeding:');
  console.table(INITIAL_PERSONA_USERS);
  console.log('[RMRIT Database] Full database execution active in Database Design Phase.');
}

if (process.argv[1]?.includes('run-seed')) {
  runSeeds().catch(console.error);
}
