#!/usr/bin/env node

const http = require('http');

const targetUrl = process.env.BACKEND_URL || 'http://127.0.0.1:3000/api/health';

console.log(`[RMRIT] Checking health at: ${targetUrl}`);

const req = http.get(targetUrl, (res) => {
  let data = '';
  res.on('data', (chunk) => (data += chunk));
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log(`[RMRIT] ✓ Health check succeeded (HTTP 200):`);
      console.log(data);
      process.exit(0);
    } else {
      console.error(`[RMRIT] ✕ Health check returned HTTP ${res.statusCode}: ${data}`);
      process.exit(1);
    }
  });
});

req.on('error', (err) => {
  console.error(`[RMRIT] ✕ Could not connect to backend: ${err.message}`);
  process.exit(1);
});
