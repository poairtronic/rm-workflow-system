#!/usr/bin/env node

/**
 * Development Environment Verification Script
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..', '..');

console.log('[RMRIT] Verifying local development prerequisites...');

// Check .env
const envPath = path.join(rootDir, '.env');
const envExamplePath = path.join(rootDir, '.env.example');

if (!fs.existsSync(envPath)) {
  if (fs.existsSync(envExamplePath)) {
    console.log('[RMRIT] Notice: .env file not found. Creating from .env.example...');
    fs.copyFileSync(envExamplePath, envPath);
    console.log('[RMRIT] ✓ Created .env from template.');
  }
} else {
  console.log('[RMRIT] ✓ .env file is present.');
}

console.log('[RMRIT] Development environment setup verified.');
