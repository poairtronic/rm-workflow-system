export const SEED_CUSTOMERS = [
  {
    name: 'Bharat Dynamics Limited',
    code: 'BDL-IND',
    contactPerson: 'K. S. Rao',
    email: 'ksrao@bdl.gov.in',
    phone: '+91-40-23456789',
  },
];

export const SEED_PURCHASE_ORDERS = [
  {
    poNumber: 'PO-TEST-001',
    customerCode: 'BDL-IND',
    referenceDate: '2026-08-15',
    remarks: 'Sample PO for development validation',
    components: [
      {
        scNumber: 'SC-TEST-001',
        productName: 'Main Drive Spindle Shaft',
        drawingNumber: 'DWG-SP-101-REV-C',
        targetQuantity: 10,
        status: 'IN_PRODUCTION',
        rmItems: [
          {
            material: 'EN31',
            materialType: 'ROUND_BAR',
            grade: 'IS:5517',
            size: 'Ø110 x 35 mm',
            quantity: 10,
            diameter: 110,
            length: 35,
            weight: 26.5,
            weightUnit: 'KG',
            remarks: 'Case hardening alloy steel',
          },
        ],
      },
    ],
  },
];
