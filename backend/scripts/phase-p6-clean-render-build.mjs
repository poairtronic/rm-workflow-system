import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync, spawn } from 'child_process';
import http from 'http';

async function testCleanBuild() {
  console.log('===============================================================');
  console.log('STEP 2: CLEAN PRODUCTION BUILD SIMULATION (EXACTLY AS RENDER)');
  console.log('===============================================================');

  const tempDir = path.join(os.tmpdir(), `vsmart-render-build-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });
  console.log(`Created clean temp directory: ${tempDir}`);

  const backendSrc = path.resolve('backend');
  const tempBackend = path.join(tempDir, 'backend');
  fs.mkdirSync(tempBackend, { recursive: true });

  console.log('Copying backend source files (excluding node_modules, dist, .env)...');
  const items = fs.readdirSync(backendSrc);
  for (const item of items) {
    if (item === 'node_modules' || item === 'dist' || item === '.env' || item.startsWith('.env.')) {
      continue;
    }
    const srcPath = path.join(backendSrc, item);
    const dstPath = path.join(tempBackend, item);
    fs.cpSync(srcPath, dstPath, { recursive: true });
  }

  console.log('Symlinking node_modules to avoid re-downloading entire npm registry...');
  // Symlink existing node_modules from root and backend
  const rootNodeModules = path.resolve('node_modules');
  const tempRootNodeModules = path.join(tempDir, 'node_modules');
  try {
    fs.symlinkSync(rootNodeModules, tempRootNodeModules, 'junction');
  } catch (e) {
    console.log('Root symlink note:', e.message);
  }

  const targetNodeModules = path.join(backendSrc, 'node_modules');
  const linkNodeModules = path.join(tempBackend, 'node_modules');
  try {
    fs.symlinkSync(targetNodeModules, linkNodeModules, 'junction');
  } catch (e) {
    console.log('Backend symlink note:', e.message);
  }

  console.log('Executing Render backend build command: npm run build ...');
  execSync('npm run build', { cwd: tempBackend, stdio: 'inherit', env: { ...process.env, NODE_ENV: 'production' } });

  console.log('Build succeeded. Now verifying production boot of compiled dist/main.js ...');
  const port = '3015';
  const proc = spawn('node', ['dist/main.js'], {
    cwd: tempBackend,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      EMAIL_PROVIDER_TYPE: 'test',
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/rm_workflow_db',
      JWT_SECRET: process.env.JWT_SECRET || 'render_prod_test_secret_1234567890_clean_build',
      SUPABASE_URL: process.env.SUPABASE_URL || 'https://vsmart-placeholder.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || 'vsmart_service_role_dummy_key_production_check',
      FRONTEND_URL: process.env.FRONTEND_URL || 'https://v-smart-frontend.onrender.com',
      PORT: port,
      TYPEORM_SYNC: 'false',
    },
  });

  proc.stdout.on('data', (d) => process.stdout.write(d.toString()));
  proc.stderr.on('data', (d) => process.stderr.write(d.toString()));

  let procExited = false;
  proc.on('exit', (code) => {
    procExited = true;
    console.log(`Process exited with code ${code}`);
  });

  let healthy = false;
  for (let i = 0; i < 35; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    if (procExited) break;
    try {
      const res = await new Promise((resolve, reject) => {
        const req = http.get(`http://localhost:${port}/api/health`, (res) => {
          let data = '';
          res.on('data', (c) => data += c);
          res.on('end', () => resolve({ statusCode: res.statusCode, data }));
        });
        req.on('error', reject);
        req.setTimeout(1000, () => req.destroy(new Error('timeout')));
      });
      if (res.statusCode === 200) {
        console.log(`✓ SUCCESS: /api/health returned 200 OK: ${res.data}`);
        healthy = true;
        break;
      }
    } catch {
      // retry
    }
  }

  proc.kill('SIGINT');
  
  // Cleanup tempDir
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
    console.log(`Cleaned up temporary build directory: ${tempDir}`);
  } catch (err) {
    console.log(`Note: Cleanup deferred: ${err.message}`);
  }

  if (!healthy) {
    throw new Error('Clean production build health check failed!');
  }

  console.log('STEP 2 CLEAN PRODUCTION BUILD VERIFICATION PASSED!');
}

testCleanBuild().catch((err) => {
  console.error('Clean build test failed:', err);
  process.exit(1);
});
