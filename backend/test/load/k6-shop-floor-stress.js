import http from 'k6/http';
import { check, sleep } from 'k6';

// k6 Load & Concurrency Stress Test Suite (Prompt 5.1 / Phase 26)
// Simulates 50 concurrent shop-floor terminals with multi-terminal IP isolation
export const options = {
  stages: [
    { duration: '5s', target: 20 },   // Warm-up ramp: 0 to 20 terminals
    { duration: '15s', target: 50 },  // Sustained peak load: 50 concurrent terminals
    { duration: '5s', target: 0 },    // Ramp-down to 0
  ],
  thresholds: {
    // 95% of requests must complete under 350ms, 99% under 600ms
    http_req_duration: ['p(95)<350', 'p(99)<600'],
    // Error rate must remain under 1% for standard read flows
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://localhost:3000';
const JWT_TOKEN = __ENV.JWT_TOKEN || '';

export default function () {
  // Simulate unique factory terminal IP to prevent false 429 rate limit lockouts
  const vuId = (__VU % 50) + 1;
  const terminalIp = `10.10.0.${vuId}`;

  const headers = {
    'Content-Type': 'application/json',
    'X-Forwarded-For': terminalIp,
    ...(JWT_TOKEN ? { Authorization: `Bearer ${JWT_TOKEN}` } : {}),
  };

  // Flow 1: Master Data Read Burst (In-Memory RAM Cache Hits)
  const resCategories = http.get(`${BASE_URL}/api/categories`, { headers });
  check(resCategories, {
    'categories status 200': (r) => r.status === 200,
    'categories cache active': (r) =>
      r.headers['X-Cache'] === 'HIT' ||
      r.headers['x-cache'] === 'HIT' ||
      r.headers['X-Cache'] === 'MISS' ||
      r.headers['x-cache'] === 'MISS',
  });

  const resProducts = http.get(`${BASE_URL}/api/products`, { headers });
  check(resProducts, {
    'products status 200': (r) => r.status === 200,
  });

  // Flow 2: Dynamic Generator Bypass Check
  const resNextCode = http.get(`${BASE_URL}/api/products/next-code`, { headers });
  check(resNextCode, {
    'next-code status 200': (r) => r.status === 200,
    'next-code bypasses cache': (r) =>
      r.headers['X-Cache'] === 'BYPASS' || r.headers['x-cache'] === 'BYPASS',
  });

  // Flow 3: Vendor Master & SLA Agreements
  const resVendors = http.get(`${BASE_URL}/api/vendors`, { headers });
  check(resVendors, {
    'vendors status 200': (r) => r.status === 200,
  });

  // Stagger request frequency naturally across factory workstations
  sleep(0.2);
}
