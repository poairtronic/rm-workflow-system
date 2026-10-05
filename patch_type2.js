const fs = require('fs');

let c = fs.readFileSync('frontend/src/components/dispatch/Type2DispatchView.tsx', 'utf8');

c = c.replace(
  "import { deliveryChallanApi } from '../../services/api';",
  "import { deliveryChallanApi, api } from '../../services/api';\nimport { useQuery } from '@tanstack/react-query';"
);

c = c.replace(
  "const methods = useForm<CreateDeliveryChallanDto>({",
  `const { data: vendorList } = useQuery({ queryKey: ['vendors'], queryFn: () => api.get<any[]>('/api/vendors?isActive=true') });
  
  const methods = useForm<CreateDeliveryChallanDto>({`
);

c = c.replace(/destinationEntity/g, "vendorId");

c = c.replace(
  /<option value="INT-RND">R&D Department \(Internal\)<\/option>\s*<option value="INT-MAINT">Maintenance Dept \(Internal\)<\/option>\s*<option value="EXT-VND-03">Vendor 03 \(External Calibration\)<\/option>/g,
  `{vendorList?.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}`
);

c = c.replace(/Destination Entity/g, "Vendor Destination");
c = c.replace(/Select Destination\.\.\./g, "Select Vendor...");
c = c.replace(/purpose/g, "notes");
c = c.replace(/Purpose \/ Justification/g, "Notes");
c = c.replace(/type: 'GENERAL_OUTWARD'/g, "type: 'GENERAL_INVENTORY_OUTWARD'");

fs.writeFileSync('frontend/src/components/dispatch/Type2DispatchView.tsx', c);
