const fs = require('fs');

let c = fs.readFileSync('frontend/src/components/dispatch/Type1DispatchWizard.tsx', 'utf8');

c = c.replace(
  "import { useMutation, useQueryClient } from '@tanstack/react-query';",
  "import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';"
);

c = c.replace(
  "import { deliveryChallanApi } from '../../services/api';",
  "import { deliveryChallanApi, api } from '../../services/api';"
);

c = c.replace(/scCode: '',/, "scId: '',");
c = c.replace(/const scCode = watch\('scCode'\);/, "const scId = watch('scId');");

c = c.replace(/\{...register\('scCode'/g, "{...register('scId'");
c = c.replace(/disabled=\{\!scCode\}/g, "disabled={!scId}");
c = c.replace(/!scCode/g, "!scId");

c = c.replace(
  /<option value="SC-2026-004">SC-2026-004 \(Aerospace Assembly\)<\/option>\s*<option value="SC-2026-009">SC-2026-009 \(Automotive Drive\)<\/option>/g,
  "{scList?.map(sc => <option key={sc.id} value={sc.id}>{sc.code} ({sc.poNumber})</option>)}"
);

c = c.replace(
  /<option value="PRC-CNC-01">CNC Turning<\/option>\s*<option value="PRC-HT-01">Heat Treatment<\/option>\s*<option value="PRC-ANO-01">Anodizing<\/option>/g,
  "{processList?.map(p => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}"
);

c = c.replace(
  /<option value="VND-APX-001">Apex Processors Ltd\.<\/option>\s*<option value="VND-ST-002\">SteelTech Industries<\/option>/g,
  "{slaList?.filter(s => s.processId === processId).map(s => <option key={s.vendorId} value={s.vendorId}>{s.vendorName}</option>)}"
);

const queries = `
  const processId = watch('processId');
  const vendorId = watch('vendorId');

  const { data: scList } = useQuery({ queryKey: ['sc'], queryFn: () => api.get<any[]>('/api/sc') });
  const { data: processList } = useQuery({ queryKey: ['processes'], queryFn: () => api.get<any[]>('/api/production-processes') });
  const { data: slaList } = useQuery({ queryKey: ['vendor-slas'], queryFn: () => api.get<any[]>('/api/vendors/slas') });
`;
c = c.replace("const processId = watch('processId');", queries);

c = c.replace(
  /\/\/ Auto-calculate expected return date for step 2 simulation[\s\S]*?\} \}, \[\]\);/g,
  `useEffect(() => {
    if (vendorId && processId && slaList) {
      const sla = slaList.find(s => s.vendorId === vendorId && s.processId === processId);
      if (sla) {
        const date = new Date();
        date.setDate(date.getDate() + sla.slaDays);
        setValue('expectedReturnDate', date.toISOString().split('T')[0]);
      }
    }
  }, [vendorId, processId, slaList, setValue]);`
);

// We should also replace the item mapping from the form (materialCode -> productId, sourceBinId -> binId)
// Wait, we can just do that in `api.ts` or in the component before submit.
// The prompt says: "Send the exact payload that the backend /type-1 DTO expects (use the mapping already in api.ts)."
// The mapping in `api.ts` was already done for `deliveryChallanApi.create` in Phase 2!
// Wait! Let me check `api.ts` `create`. It expects `items` to have `productId` and `binId`.
// I will just map it in `Type1DispatchWizard` onSubmit. Or `api.ts`.
// But I need to change `DispatchPayloadGrid` anyway to use Product Dropdown and Bin Dropdown.
// Let's do that for `DispatchPayloadGrid` next.

fs.writeFileSync('frontend/src/components/dispatch/Type1DispatchWizard.tsx', c);
