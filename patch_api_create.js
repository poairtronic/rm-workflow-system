const fs = require('fs');

let c = fs.readFileSync('frontend/src/services/api.ts', 'utf8');

const oldCreate = `create: (data: CreateDeliveryChallanDto) => {
    const isType1 = data.type === 'TYPE_1';
    const endpoint = isType1 ? '/api/delivery-challans/type-1' : '/api/delivery-challans/type-2';
    
    // Convert to backend shape
    const backendPayload = {
      type: isType1 ? 'PRODUCTION_PROCESS_OUTWARD' : 'GENERAL_INVENTORY_OUTWARD',
      vendorId: isType1 ? data.vendorId : '00000000-0000-0000-0000-000000000000', // Mock UUID for internal entity if backend requires vendorId
      scId: data.scCode && data.scCode.length === 36 ? data.scCode : '00000000-0000-0000-0000-000000000000',
      processId: data.processId && data.processId.length === 36 ? data.processId : '00000000-0000-0000-0000-000000000000',
      dispatchDate: new Date().toISOString(),
      expectedReturnDate: data.expectedReturnDate,
      notes: data.purpose || data.destinationEntity || '',
      items: data.items.map(i => ({
        productId: i.rmItemId && i.rmItemId.length === 36 ? i.rmItemId : '00000000-0000-0000-0000-000000000000',
        binId: i.binId && i.binId.length === 36 ? i.binId : '00000000-0000-0000-0000-000000000000',
        quantityDispatched: i.quantityToDispatch
      }))
    };
    
    return api.post<DeliveryChallanDto>(endpoint, backendPayload);
  },`;

const newCreate = `create: (data: any) => {
    const isType1 = data.type === 'PRODUCTION_PROCESS_OUTWARD';
    const endpoint = isType1 ? '/api/delivery-challans/type-1' : '/api/delivery-challans/type-2';
    
    const backendPayload = {
      type: data.type,
      vendorId: data.vendorId,
      ...(isType1 && { scId: data.scId, processId: data.processId, expectedReturnDate: data.expectedReturnDate }),
      dispatchDate: new Date().toISOString(),
      notes: data.notes || '',
      items: data.items.map((i: any) => ({
        productId: i.productId,
        binId: i.binId,
        quantityDispatched: i.quantity
      }))
    };
    
    return api.post<DeliveryChallanDto>(endpoint, backendPayload);
  },`;

c = c.replace(oldCreate, newCreate);
fs.writeFileSync('frontend/src/services/api.ts', c);
