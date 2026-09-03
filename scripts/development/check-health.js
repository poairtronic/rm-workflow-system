#!/usr/bin/env node

/**
 * Diagnostic Health Check Script
 * Verifies backend availability on http://localhost:3000/api/health
 */

const http = require('http');

const url = process.env.BACKEND_HEALTH_URL || 'http://localhost:3000/api/health';

console.log(`[RMRIT] Checking backend health probe at: ${url}`);

http
  .get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => (data += chunk));
    res.on('end', () => {
      console.log(`[RMRIT] Response Code: ${res.statusCode}`);
      console.log(`[RMRIT] Payload: ${data}`);
      if (res.statusCode === 200) {
        console.log('[RMRIT] ✓ Health check succeeded.');
        process.exit(0);
      } else {
        console.error('[RMRIT] ✗ Non-200 status code.');
        process.exit(1);
      }
    });
  })
  .on('error', (err) => {
    console.error(`[RMRIT] ✗ Health check failed: ${err.message}`);
    process.exit(1);
  });
