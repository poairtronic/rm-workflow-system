import { resolveVendorSla } from '../components/dc/VendorSlaSelector';

export function runFix33VendorSlaTests() {
  const mockSlaList = [
    { id: 'sla-1', vendorId: 'vendor-1', processId: 'process-ht', slaDays: 5 },
    { id: 'sla-2', vendorId: 'vendor-1', processId: 'process-machining', slaDays: 10 },
  ];

  // Test 1: Configured SLA
  const res1 = resolveVendorSla('vendor-1', 'process-ht', mockSlaList);
  if (res1.isFallback !== false || res1.slaDays !== 5 || res1.displayText !== '5 days') {
    throw new Error(`Test 1 Failed: Expected configured SLA (5 days), got ${JSON.stringify(res1)}`);
  }

  // Test 2: Fallback when vendor+process combo not in SLA list
  const res2 = resolveVendorSla('vendor-1', 'process-plating', mockSlaList);
  if (res2.isFallback !== true || res2.slaDays !== 7 || res2.displayText !== 'Default (7 days)') {
    throw new Error(`Test 2 Failed: Expected fallback SLA (Default (7 days)), got ${JSON.stringify(res2)}`);
  }

  // Test 3: Fallback when vendorId missing
  const res3 = resolveVendorSla(undefined, 'process-ht', mockSlaList);
  if (res3.isFallback !== true || res3.slaDays !== 7 || res3.displayText !== 'Default (7 days)') {
    throw new Error(`Test 3 Failed: Expected fallback when vendorId missing, got ${JSON.stringify(res3)}`);
  }

  // Test 4: Fallback when processId missing
  const res4 = resolveVendorSla('vendor-1', undefined, mockSlaList);
  if (res4.isFallback !== true || res4.slaDays !== 7 || res4.displayText !== 'Default (7 days)') {
    throw new Error(`Test 4 Failed: Expected fallback when processId missing, got ${JSON.stringify(res4)}`);
  }

  // Test 5: Fallback when slaList is empty
  const res5 = resolveVendorSla('vendor-1', 'process-ht', []);
  if (res5.isFallback !== true || res5.slaDays !== 7 || res5.displayText !== 'Default (7 days)') {
    throw new Error(`Test 5 Failed: Expected fallback when slaList empty, got ${JSON.stringify(res5)}`);
  }

  return { pass: true, count: 5 };
}

// Self-execute
runFix33VendorSlaTests();
