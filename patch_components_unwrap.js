const fs = require('fs');

function patchFile(file, replacements) {
  let c = fs.readFileSync(file, 'utf8');
  for (const [from, to] of replacements) {
    c = c.replace(from, to);
  }
  fs.writeFileSync(file, c);
}

// 1. Type1DispatchWizard
patchFile('frontend/src/components/dispatch/Type1DispatchWizard.tsx', [
  [
    "import { deliveryChallanApi, api } from '../../services/api';",
    "import { deliveryChallanApi, api, unwrapList } from '../../services/api';"
  ],
  [
    "queryFn: () => api.get<any[]>('/api/sc')",
    "queryFn: async () => unwrapList(await api.get<any[]>('/api/sc'))"
  ],
  [
    "queryFn: () => api.get<any[]>('/api/production-processes')",
    "queryFn: async () => unwrapList(await api.get<any[]>('/api/production-processes'))"
  ],
  [
    "queryFn: () => api.get<any[]>('/api/vendors/slas')",
    "queryFn: async () => unwrapList(await api.get<any[]>('/api/vendors/slas'))"
  ]
]);

// 2. DispatchPayloadRow
patchFile('frontend/src/components/dispatch/DispatchPayloadRow.tsx', [
  [
    "import { api } from '../../services/api';",
    "import { api, unwrapList } from '../../services/api';"
  ],
  [
    "queryFn: () => api.get<any[]>('/api/products')",
    "queryFn: async () => unwrapList(await api.get<any[]>('/api/products'))"
  ],
  [
    "queryFn: () => api.get<any[]>(\`/api/inventory/balances?productId=\${productId}\`)",
    "queryFn: async () => unwrapList(await api.get<any[]>(\`/api/inventory/balances?productId=\${productId}\`))"
  ]
]);

// 3. Type2DispatchView
patchFile('frontend/src/components/dispatch/Type2DispatchView.tsx', [
  [
    "import { deliveryChallanApi, api } from '../../services/api';",
    "import { deliveryChallanApi, api, unwrapList } from '../../services/api';"
  ],
  [
    "queryFn: () => api.get<any[]>('/api/vendors?isActive=true')",
    "queryFn: async () => unwrapList(await api.get<any[]>('/api/vendors?isActive=true'))"
  ]
]);
