import fetch from 'node-fetch';

const SEED_USERS = [
  { role: 'ADMIN', email: 'admin@airtronic.com' },
  { role: 'DESIGNER', email: 'designer@airtronic.com' },
  { role: 'STORES', email: 'stores@airtronic.com' },
  { role: 'PRODUCTION', email: 'production@airtronic.com' },
  { role: 'SENIOR_MANAGER', email: 'senior.manager@airtronic.com' },
  { role: 'GENERAL_MANAGER', email: 'general.manager@airtronic.com' },
];

const ROUTES = [
  { path: '/design/project-setup', endpoint: '/api/projects' }, // hypothetical
  { path: '/design/requisitions', endpoint: '/api/rm-requests' },
  { path: '/stores/issue-material', endpoint: '/api/sc-directory' },
  { path: '/inventory/msl-alerts', endpoint: '/api/traceability/analytics/inventory-msl-status' },
  { path: '/dispatch/delivery-challan/type-1', endpoint: '/api/delivery-challans' },
  { path: '/dispatch/returns', endpoint: '/api/delivery-challans?isOverdue=true' }, // or something
  { path: '/production/jobs', endpoint: '/api/sales-components' },
  { path: '/production/consumption', endpoint: '/api/production-processes' },
  { path: '/governance/process-master', endpoint: '/api/production-processes' },
  { path: '/governance/vendor-slas', endpoint: '/api/vendors/slas' },
  { path: '/governance/traceability', endpoint: '/api/traceability' },
  { path: '/governance/po-traceability', endpoint: '/api/traceability/po' },
  { path: '/governance/vendor-analytics', endpoint: '/api/traceability/vendors/performance-analytics' },
  { path: '/reports/generation', endpoint: '/api/reports' },
];

async function run() {
  for (const user of SEED_USERS) {
    console.log(`\n\n--- Testing Role: ${user.role} (${user.email}) ---`);
    try {
      const res = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, password: 'Password@123' }),
      });
      if (!res.ok) {
        console.log(`LOGIN FAILED: ${res.status}`);
        continue;
      }
      const data = await res.json();
      const token = data.access_token || data.accessToken;
      
      for (const route of ROUTES) {
        // Just checking basic endpoint access
        const req = await fetch(`http://localhost:3000${route.endpoint}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log(`[${user.role}] Page: ${route.path.padEnd(35)} -> API: ${route.endpoint.padEnd(50)} -> STATUS: ${req.status}`);
      }
    } catch (e) {
      console.log(`Error testing ${user.role}:`, e);
    }
  }
}

run();
