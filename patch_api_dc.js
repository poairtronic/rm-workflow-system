const fs = require('fs');
let c = fs.readFileSync('frontend/src/services/api.ts', 'utf8');

c = c.replace(
  "getAll: () => api.get<DeliveryChallanDto[]>('/api/delivery-challans'),",
  `getAll: async () => {
    const res = await api.get<any[]>('/api/delivery-challans');
    return res.map(dc => ({ ...dc, dcNumber: dc.challanNumber })) as DeliveryChallanDto[];
  },`
);

fs.writeFileSync('frontend/src/services/api.ts', c);
