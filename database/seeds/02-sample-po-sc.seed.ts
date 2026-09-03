export const SEED_CUSTOMERS = [
  {
    name: 'Bharat Dynamics Limited',
    code: 'BDL-IND',
    contactPerson: 'K. S. Rao',
    email: 'ksrao@bdl.gov.in',
    phone: '+91-40-23456789',
  },
  {
    name: 'Hindustan Aeronautics Limited',
    code: 'HAL-BLR',
    contactPerson: 'S. N. Pillai',
    email: 'snpillai@hal-india.co.in',
    phone: '+91-80-98765432',
  },
];

export const SEED_PURCHASE_ORDERS = [
  {
    poNumber: 'PO-2026-8801',
    customerCode: 'BDL-IND',
    referenceDate: '2026-08-15',
    remarks: 'High-precision aerospace component batch',
    components: [
      {
        scNumber: 'SC-8801-01',
        productName: 'Main Drive Spindle Shaft',
        drawingNumber: 'DWG-SP-101-REV-C',
        targetQuantity: 50,
        status: 'COMPLETED',
        rmItems: [
          {
            materialGrade: 'EN31',
            profileType: 'ROUND_BAR',
            size: 'Ø110 x 35 mm',
            requiredQuantity: 55,
            unit: 'NOS',
            diameterMm: 110,
            lengthMm: 35,
            unitWeightKg: 2.65,
            totalWeightKg: 145.75,
            remarks: 'Case hardening steel per IS:5517',
          },
        ],
      },
      {
        scNumber: 'SC-8801-02',
        productName: 'Shaft Mounting Bushing',
        drawingNumber: 'DWG-BS-204-REV-A',
        targetQuantity: 100,
        status: 'IN_PRODUCTION',
        rmItems: [
          {
            materialGrade: 'OHNS',
            profileType: 'ROUND_BAR',
            size: 'Ø75 x 50 mm',
            requiredQuantity: 105,
            unit: 'NOS',
            diameterMm: 75,
            lengthMm: 50,
            unitWeightKg: 1.73,
            totalWeightKg: 181.65,
            remarks: 'Oil hardening non-shrinking tool steel',
          },
        ],
      },
      {
        scNumber: 'SC-8801-03',
        productName: 'Retaining End Flange',
        drawingNumber: 'DWG-FL-309-REV-B',
        targetQuantity: 50,
        status: 'STORES_PENDING',
        rmItems: [
          {
            materialGrade: 'MS',
            profileType: 'PLATE',
            size: '150 x 150 x 25 mm',
            requiredQuantity: 52,
            unit: 'NOS',
            lengthMm: 150,
            widthMm: 150,
            thicknessMm: 25,
            unitWeightKg: 4.415,
            totalWeightKg: 229.58,
            remarks: 'Mild steel plate per IS:2062 Grade E250',
          },
        ],
      },
    ],
  },
];
