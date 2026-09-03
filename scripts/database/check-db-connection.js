#!/usr/bin/env node

/**
 * Database Connection Diagnostic Script
 */

const { URL } = require('url');

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.log('[RMRIT Database] No DATABASE_URL set. Running in local default mode.');
} else {
  try {
    const parsed = new URL(dbUrl);
    console.log(`[RMRIT Database] Target Host: ${parsed.hostname}:${parsed.port || 5432}`);
    console.log(`[RMRIT Database] Target DB: ${parsed.pathname.replace('/', '')}`);
    console.log(`[RMRIT Database] SSL Mode: ${parsed.searchParams.get('sslmode') || 'default'}`);
  } catch (err) {
    console.error(`[RMRIT Database] Invalid DATABASE_URL format: ${err.message}`);
  }
}
