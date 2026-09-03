#!/usr/bin/env node

/**
 * Deployment Build Verification Script
 * Validates existence and basic structure of production build artifacts.
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..', '..');
const frontendDist = path.join(rootDir, 'frontend', 'dist');
const backendDist = path.join(rootDir, 'backend', 'dist');

console.log('[RMRIT] Verifying build outputs for deployment...');

const frontendOk =
  fs.existsSync(frontendDist) && fs.existsSync(path.join(frontendDist, 'index.html'));
const backendOk =
  fs.existsSync(backendDist) && fs.existsSync(path.join(backendDist, 'main.js'));

console.log(`[RMRIT] Frontend dist ready: ${frontendOk ? '✓' : '✗'}`);
console.log(`[RMRIT] Backend dist ready:  ${backendOk ? '✓' : '✗'}`);

if (!frontendOk || !backendOk) {
  console.log('[RMRIT] Run `npm run build` in frontend and backend before deploying.');
} else {
  console.log('[RMRIT] ✓ All build artifacts verified for deployment.');
}
