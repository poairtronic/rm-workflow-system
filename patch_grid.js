const fs = require('fs');

let c = fs.readFileSync('frontend/src/components/dispatch/DispatchPayloadGrid.tsx', 'utf8');

c = c.replace(
  "import { Plus, Trash2 } from 'lucide-react';",
  "import { Plus, Trash2 } from 'lucide-react';\nimport { useQuery } from '@tanstack/react-query';\nimport { api } from '../../services/api';"
);

c = c.replace(
  "const { fields, append, remove } = useFieldArray({",
  `const { data: products } = useQuery({ queryKey: ['products'], queryFn: () => api.get<any[]>('/api/products') });
  const { data: bins } = useQuery({ queryKey: ['bins'], queryFn: () => api.get<any[]>('/api/bins') });
  
  const { fields, append, remove } = useFieldArray({`
);

// We need to change materialCode to productId, sourceBinId to binId, and also watch to show available quantity.
c = c.replace(/materialCode/g, "productId");
c = c.replace(/sourceBinId/g, "binId");

c = c.replace(
  /<input\s*\{\.\.\.register\(`items\.\$\{index\}\.productId` as const, \{ required: 'Required' \}\)\}\s*className="w-full h-9 px-3 rounded-md bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"\s*placeholder="e\.g\. RM-AL-6061"\s*\/>/g,
  `<select
    {...register(\`items.\${index}.productId\` as const, { required: 'Required' })}
    className="w-full h-9 px-3 rounded-md bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
  >
    <option value="">Select Product...</option>
    {products?.map(p => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}
  </select>`
);

c = c.replace(
  /<option value="BIN-A1-01">BIN-A1-01<\/option>\s*<option value="BIN-B2-04">BIN-B2-04<\/option>/g,
  `{bins?.map(b => <option key={b.id} value={b.id}>{b.code}</option>)}`
);

// We are asked to show Available quantity. But there is no endpoint. I'll just write "N/A" for available.
// Wait, I can just mock available quantity for now, or don't display it since backend doesn't support it.
// The prompt: "Available: show current quantity for the selected product+bin... Dispatch qty: block above available"
// Since backend doesn't support it, I will fetch `GET /api/inventory`? No, inventory doesn't have bin stock.
// I will just add a small mock for the UI or rely on `api.ts` to mock it. Let's just leave it out and note it in the report.
// Actually, I can use a standard `useWatch` to get the selected product and bin, but since there's no API, I will skip the inline red message or use a dummy.

fs.writeFileSync('frontend/src/components/dispatch/DispatchPayloadGrid.tsx', c);
