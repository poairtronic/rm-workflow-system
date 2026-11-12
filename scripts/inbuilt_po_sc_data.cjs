const path = require('path');
require(path.resolve('backend/node_modules/dotenv')).config({ path: path.resolve('backend/.env') });
const { Client } = require('pg');
const { randomUUID } = require('crypto');

async function run() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  console.log('Connected to database. Starting transaction...');
  await c.query('BEGIN');

  try {
    const actorId = '7beb2586-b3f7-4cc6-8763-76cfb99a4dc5'; // RAMU (Admin)

    // 1. Ensure Customers exist
    // Check STELLANTIS
    let stellantis = await c.query("SELECT id FROM customers WHERE name ILIKE '%STELLANTIS%'");
    const stellantisId = stellantis.rows[0]?.id;
    if (!stellantisId) throw new Error('Customer STELLANTIS not found');

    // Check LGB
    let lgb = await c.query("SELECT id FROM customers WHERE name ILIKE '%LGB%'");
    const lgbId = lgb.rows[0]?.id;
    if (!lgbId) throw new Error('Customer LGB not found');

    // Check or insert SYSMAC
    let sysmac = await c.query("SELECT id FROM customers WHERE name ILIKE '%SYSMAC%'");
    let sysmacId = sysmac.rows[0]?.id;
    if (!sysmacId) {
      const newCust = await c.query(
        `INSERT INTO customers (id, code, name, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, true, NOW(), NOW())
         RETURNING id`,
        [randomUUID(), 'CUST-SYSMAC-1356', 'SYSMAC']
      );
      sysmacId = newCust.rows[0].id;
      console.log('Created customer SYSMAC:', sysmacId);
    } else {
      console.log('Found existing customer SYSMAC:', sysmacId);
    }

    // Product ID for JIG FEET
    let jigFeetProd = await c.query("SELECT id FROM products WHERE name = 'JIG FEET'");
    const jigFeetProdId = jigFeetProd.rows[0]?.id || null;

    // 2. Define Dataset
    const dataset = [
      {
        poNumber: 'AGIPLPO1340 - STELLANTIS',
        customerId: stellantisId,
        referenceDate: '2026-10-31',
        externalRef: null,
        remarks: 'https://drive.google.com/file/d/1S_-YqCwtlRYj0ycWVBT61W42tDrx_QJO/view?usp=sharing',
        scs: [
          {
            scNumber: '2550',
            targetQuantity: 1,
            productName: 'ARG DIA 25.0 +0.02 / +0.002',
            items: [
              {
                partName: 'ARG DIA 25.0 +0.02 / +0.002',
                quantity: 1,
                unit: 'NOS',
                material: 'ARG DIA 25.0 +0.02 / +0.002',
                originalMaterial: 'EN31',
                size: 'RACK NO 35 OR Ø85X25',
                originalSize: 'RACK NO 35 OR Ø85X25',
                remarks: 'Raw Material: EN31 ( RACK NO 35 OR Ø85X25) | MOVE TO M1 | INHOUSE | M1V-V38 | 05/11/2026 18:17:46'
              },
              {
                partName: 'SP DIA 25.0 +0.02 / +0.002',
                quantity: 1,
                unit: 'SET',
                material: 'SP DIA 25.0 +0.02 / +0.002',
                originalMaterial: 'EN31',
                size: 'RACK NO 35 OR Ø85X25',
                originalSize: 'RACK NO 35 OR Ø85X25',
                remarks: 'PUNE SENT | 11/11/2026 15:54:43'
              }
            ]
          },
          {
            scNumber: '2551',
            targetQuantity: 1,
            productName: 'ARG DIA 25.0 +0.025 / +0.002',
            items: [
              {
                partName: 'ARG DIA 25.0 +0.025 / +0.002',
                quantity: 1,
                unit: 'NOS',
                material: 'ARG DIA 25.0 +0.025 / +0.002',
                originalMaterial: 'EN31',
                size: 'RACK NO 35 OR Ø85X25',
                originalSize: 'RACK NO 35 OR Ø85X25',
                remarks: 'Raw Material: EN31 ( RACK NO 35 OR Ø85X25) | MOVE TO M1 | INHOUSE | M1V-V38 | 06/11/2026 13:31:54'
              },
              {
                partName: 'SP DIA 25.0 +0.025 / +0.002',
                quantity: 1,
                unit: 'SET',
                material: 'SP DIA 25.0 +0.025 / +0.002',
                originalMaterial: 'EN31',
                size: 'RACK NO 35 OR Ø85X25',
                originalSize: 'RACK NO 35 OR Ø85X25',
                remarks: 'PUNE SENT | 11/11/2026 15:54:41'
              }
            ]
          },
          {
            scNumber: '2552',
            targetQuantity: 1,
            productName: 'ARG DIA 22.00 +0.022',
            items: [
              {
                partName: 'ARG DIA 22.00 +0.022',
                quantity: 1,
                unit: 'NOS',
                material: 'ARG DIA 22.00 +0.022',
                originalMaterial: 'EN31',
                size: 'RACK NO 34 OR DIA 70 X 25',
                originalSize: 'RACK NO 34 OR DIA 70 X 25',
                remarks: 'Raw Material: EN31 RACK NO 34 OR DIA 70 X 25 | MOVE TO M1 | INHOUSE | M1V-V38 | 06/11/2026 13:34:23'
              },
              {
                partName: 'SP DIA 22.00 +0.022',
                quantity: 1,
                unit: 'SET',
                material: 'SP DIA 22.00 +0.022',
                originalMaterial: 'EN31',
                size: 'RACK NO 34 OR DIA 70 X 25',
                originalSize: 'RACK NO 34 OR DIA 70 X 25',
                remarks: 'PUNE SENT | 11/11/2026 15:54:40'
              }
            ]
          },
          {
            scNumber: '2553',
            targetQuantity: 1,
            productName: 'ARG DIA 21.785 -0.02',
            items: [
              {
                partName: 'ARG DIA 21.785 -0.02',
                quantity: 1,
                unit: 'NOS',
                material: 'ARG DIA 21.785 -0.02',
                originalMaterial: 'EN31',
                size: 'RACK NO 34 OR DIA 70 X 25',
                originalSize: 'RACK NO 34 OR DIA 70 X 25',
                remarks: 'Raw Material: EN31 RACK NO 34 OR DIA 70 X 25 | MOVE TO M1 | INHOUSE | M1V-V38 | 05/11/2026 18:18:07'
              },
              {
                partName: 'SP DIA 21.785 -0.02',
                quantity: 1,
                unit: 'SET',
                material: 'SP DIA 21.785 -0.02',
                originalMaterial: 'EN31',
                size: 'RACK NO 34 OR DIA 70 X 25',
                originalSize: 'RACK NO 34 OR DIA 70 X 25',
                remarks: 'PUNE SENT | 11/11/2026 15:54:38'
              }
            ]
          },
          {
            scNumber: '2554',
            targetQuantity: 1,
            productName: 'ARG DIA 32.00 +0.024',
            items: [
              {
                partName: 'ARG DIA 32.00 +0.024',
                quantity: 1,
                unit: 'NOS',
                material: 'ARG DIA 32.00 +0.024',
                originalMaterial: 'EN31',
                size: 'RACK NO 35 OR Ø85X25',
                originalSize: 'RACK NO 35 OR Ø85X25',
                remarks: 'Raw Material: EN31 ( RACK NO 35 OR Ø85X25) | MOVE TO M1 | INHOUSE | M1V-V38 | 05/11/2026 18:17:52'
              },
              {
                partName: 'SP DIA 32.00 +0.024',
                quantity: 1,
                unit: 'SET',
                material: 'SP DIA 32.00 +0.024',
                originalMaterial: 'EN31',
                size: 'RACK NO 35 OR Ø85X25',
                originalSize: 'RACK NO 35 OR Ø85X25',
                remarks: 'PUNE SENT | 11/11/2026 15:54:37'
              }
            ]
          },
          {
            scNumber: '2555',
            targetQuantity: 1,
            productName: 'ACG DIA 36.0 +0.025 / +0.009',
            items: [
              {
                partName: 'ACG DIA 36.0 +0.025 / +0.009',
                quantity: 1,
                unit: 'NOS',
                material: 'ACG DIA 36.0 +0.025 / +0.009',
                originalMaterial: 'EN31',
                size: '40X55X20',
                originalSize: '40X55X20',
                remarks: 'Raw Material: EN31 40X55X20 | MOVE TO MILLING | WITH VENDOR | FBV-V38 | 06/11/2026 17:59:51'
              },
              {
                partName: 'SETTING DISC 36.0 +0.025 / +0.009',
                quantity: 1,
                unit: 'SET',
                material: 'SETTING DISC 36.0 +0.025 / +0.009',
                originalMaterial: 'OHNS',
                size: 'Ø40X35',
                originalSize: 'Ø40X35',
                remarks: 'Raw Material: OHNS Ø40X35 | MOVE TO FB-RK | WITH VENDOR | FBV-V2 | 06/11/2026 18:37:41'
              },
              {
                partName: 'SIDE BLOCKS',
                quantity: 2,
                unit: 'NOS',
                material: 'SIDE BLOCKS',
                originalMaterial: 'EN31',
                size: '70X20X18',
                originalSize: '70X20X18',
                remarks: 'Raw Material: EN31 70X20X18 | MOVE TO MILLING | WITH VENDOR | FBV-V38 | 06/11/2026 17:59:55'
              },
              {
                partName: 'NYLON HANDLE',
                quantity: 4,
                unit: 'NOS',
                material: 'NYLON HANDLE',
                originalMaterial: 'NYLON',
                size: 'Ø25X18',
                originalSize: 'Ø25X18',
                remarks: 'Raw Material: NYLON Ø25X18 | NYLONHANDLE | 06/11/2026 10:15:51'
              },
              {
                partName: 'CARBIDE 10X3X17',
                quantity: 2,
                unit: 'NOS',
                material: 'CARBIDE 10X3X17',
                originalMaterial: 'CARBIDE',
                size: '10X3X17',
                originalSize: '10X3X17',
                remarks: 'Raw Material: CARBIDE 10X3X17 | BHARGAVI | 06/11/2026 15:39:48'
              },
              {
                partName: 'CARBIDE 8X3X17',
                quantity: 2,
                unit: 'NOS',
                material: 'CARBIDE 8X3X17',
                originalMaterial: 'CARBIDE',
                size: '8X3X17',
                originalSize: '8X3X17',
                remarks: 'Raw Material: CARBIDE 8X3X17 | BHARGAVI | 06/11/2026 15:39:50'
              }
            ]
          },
          {
            scNumber: '2556',
            targetQuantity: 1,
            productName: 'ARG DIA 25.0 +0.015 / +0.002',
            items: [
              {
                partName: 'ARG DIA 25.0 +0.015 / +0.002',
                quantity: 1,
                unit: 'NOS',
                material: 'ARG DIA 25.0 +0.015 / +0.002',
                originalMaterial: 'EN31',
                size: 'RACK NO 35 OR Ø85X25',
                originalSize: 'RACK NO 35 OR Ø85X25',
                remarks: 'Raw Material: EN31 ( RACK NO 35 OR Ø85X25) | MOVE TO M1 | INHOUSE | M1V-V38 | 05/11/2026 18:17:56'
              },
              {
                partName: 'SP DIA 25.0 +0.015 / +0.002',
                quantity: 1,
                unit: 'SET',
                material: 'SP DIA 25.0 +0.015 / +0.002',
                originalMaterial: 'EN31',
                size: 'RACK NO 35 OR Ø85X25',
                originalSize: 'RACK NO 35 OR Ø85X25',
                remarks: 'PUNE SENT | 11/11/2026 15:54:19'
              }
            ]
          },
          {
            scNumber: '2557',
            targetQuantity: 1,
            productName: 'ARG DIA 25.00 +0.013',
            items: [
              {
                partName: 'ARG DIA 25.00 +0.013',
                quantity: 1,
                unit: 'NOS',
                material: 'ARG DIA 25.00 +0.013',
                originalMaterial: 'EN31',
                size: 'RACK NO 35 OR Ø85X25',
                originalSize: 'RACK NO 35 OR Ø85X25',
                remarks: 'Raw Material: EN31 ( RACK NO 35 OR Ø85X25) | MOVE TO M1 | INHOUSE | M1V-V38 | 05/11/2026 18:17:59'
              },
              {
                partName: 'SP DIA 25.00 +0.013',
                quantity: 1,
                unit: 'SET',
                material: 'SP DIA 25.00 +0.013',
                originalMaterial: 'EN31',
                size: 'RACK NO 35 OR Ø85X25',
                originalSize: 'RACK NO 35 OR Ø85X25',
                remarks: 'PUNE SENT | 11/11/2026 15:54:15'
              }
            ]
          },
          {
            scNumber: '2558',
            targetQuantity: 1,
            productName: 'ARG DIA 25.00 +0.031 / +0.018',
            items: [
              {
                partName: 'ARG DIA 25.00 +0.031 / +0.018',
                quantity: 1,
                unit: 'NOS',
                material: 'ARG DIA 25.00 +0.031 / +0.018',
                originalMaterial: 'EN31',
                size: 'RACK NO 35 OR Ø85X25',
                originalSize: 'RACK NO 35 OR Ø85X25',
                remarks: 'Raw Material: EN31 ( RACK NO 35 OR Ø85X25) | MOVE TO M1 | INHOUSE | M1V-V38 | 05/11/2026 18:18:01'
              },
              {
                partName: 'SP DIA 25.0 +0.031 / +0.018',
                quantity: 1,
                unit: 'SET',
                material: 'SP DIA 25.0 +0.031 / +0.018',
                originalMaterial: 'EN31',
                size: 'RACK NO 35 OR Ø85X25',
                originalSize: 'RACK NO 35 OR Ø85X25',
                remarks: 'PUNE SENT | 11/11/2026 15:54:12'
              }
            ]
          }
        ]
      },
      {
        poNumber: 'AGIPLPO1356 - SYSMAC',
        customerId: sysmacId,
        referenceDate: '2026-11-03',
        externalRef: '182',
        remarks: 'https://drive.google.com/file/d/1CH0t4aOKPjG7lo8pch2uhPmvSyYtljSs/view?usp=sharing',
        scs: [
          {
            scNumber: '2564',
            targetQuantity: 1,
            productName: 'ARG DIA 14.980 +/-0.02',
            drawingNumber: '182',
            items: [
              {
                partName: 'ARG DIA 14.980 +/-0.02',
                quantity: 1,
                unit: 'NOS',
                material: 'ARG DIA 14.980 +/-0.02',
                originalMaterial: 'EN31',
                size: 'Ø75X25',
                originalSize: 'Ø75X25',
                remarks: 'Raw Material: EN31 Ø75X25 | MOVE TO FB-ABI | INHOUSE | FBI'
              },
              {
                partName: 'SP DIA 14.980 +/-0.02',
                quantity: 1,
                unit: 'SET',
                material: 'SP DIA 14.980 +/-0.02',
                originalMaterial: 'EN31',
                size: 'Ø75X25',
                originalSize: 'Ø75X25',
                remarks: 'PUNE SENT'
              },
              {
                partName: 'VERTICAL BENCH MOUNT',
                quantity: 1,
                unit: 'NOS',
                material: 'VERTICAL BENCH MOUNT',
                originalMaterial: 'MS',
                size: 'Ø150X15',
                originalSize: 'Ø150X15',
                remarks: 'Raw Material: MS Ø150X15 | RM'
              },
              {
                partName: 'JIG FEET',
                quantity: 3,
                unit: 'NOS',
                material: 'JIG FEET',
                originalMaterial: 'MS',
                size: 'Ø20X75',
                originalSize: 'Ø20X75',
                mappedProductId: jigFeetProdId,
                remarks: 'Raw Material: MS Ø20X75 | STORES'
              }
            ]
          }
        ]
      },
      {
        poNumber: 'AGIPLPO1382-LGB',
        customerId: lgbId,
        referenceDate: '2026-11-05',
        externalRef: null,
        remarks: 'https://drive.google.com/file/d/1D3OoSrtxETFn9ctaLqbOkZMAhqC5h33Z/view?usp=sharing',
        scs: [
          {
            scNumber: '2569',
            targetQuantity: 2, // Combined 2569-1 and 2569-2
            productName: 'APG DIA 19.011 +/-0.005',
            items: [
              {
                partName: 'APG DIA 19.011 +/-0.005',
                quantity: 2,
                unit: 'NOS',
                material: 'APG DIA 19.011 +/-0.005',
                originalMaterial: 'EN31',
                size: 'RACK NO 10 OR Ø25X50',
                originalSize: 'RACK NO 10 OR Ø25X50',
                remarks: 'Raw Material: EN31 ( RACK NO 10 OR Ø25X50) | MOVE TO FB-SS | FBI | Consolidated 2569-1 & 2569-2 (Qty: 2)'
              },
              {
                partName: 'SRG DIA 19.011 +/-0.005',
                quantity: 2,
                unit: 'SET',
                material: 'SRG DIA 19.011 +/-0.005',
                originalMaterial: 'OHNS',
                size: 'RACK NO 6 OR Ø50X18',
                originalSize: 'RACK NO 6 OR Ø50X18',
                remarks: 'Raw Material: OHNS ( RACK NO 6 OR Ø50X18) | MOVE TO LATHE | INHOUSE | LATHE-HARD | Consolidated 2569-1 & 2569-2 (Qty: 2)'
              },
              {
                partName: 'EXTENSION 25 mm',
                quantity: 2,
                unit: 'NOS',
                material: 'EXTENSION 25 mm',
                originalMaterial: 'RACK NO 85',
                size: 'RACK NO 85',
                originalSize: 'RACK NO 85',
                remarks: 'RM | Consolidated 2569-1 & 2569-2 (Qty: 2)'
              }
            ]
          },
          {
            scNumber: '2570',
            targetQuantity: 2, // Combined 2570-1 and 2570-2
            productName: 'APG DIA 19.409 +/-0.005',
            items: [
              {
                partName: 'APG DIA 19.409 +/-0.005',
                quantity: 2,
                unit: 'NOS',
                material: 'APG DIA 19.409 +/-0.005',
                originalMaterial: 'EN31',
                size: 'RACK NO 10 OR Ø25X50',
                originalSize: 'RACK NO 10 OR Ø25X50',
                remarks: 'Raw Material: EN31 ( RACK NO 10 OR Ø25X50) | MOVE TO FB-SS | FBI | Consolidated 2570-1 & 2570-2 (Qty: 2)'
              },
              {
                partName: 'SRG DIA 19.409 +/-0.005',
                quantity: 2,
                unit: 'SET',
                material: 'SRG DIA 19.409 +/-0.005',
                originalMaterial: 'OHNS',
                size: 'RACK NO 6 OR Ø50X18',
                originalSize: 'RACK NO 6 OR Ø50X18',
                remarks: 'Raw Material: OHNS ( RACK NO 6 OR Ø50X18) | MOVE TO LATHE | INHOUSE | LATHE-HARD | Consolidated 2570-1 & 2570-2 (Qty: 2)'
              },
              {
                partName: 'EXTENSION 25 mm',
                quantity: 2,
                unit: 'NOS',
                material: 'EXTENSION 25 mm',
                originalMaterial: 'RACK NO 85',
                size: 'RACK NO 85',
                originalSize: 'RACK NO 85',
                remarks: 'RM | Consolidated 2570-1 & 2570-2 (Qty: 2)'
              }
            ]
          }
        ]
      }
    ];

    let totalPOs = 0;
    let totalSCs = 0;
    let totalRmItems = 0;

    for (const poData of dataset) {
      // 1. Insert Purchase Order
      const poId = randomUUID();
      const poRes = await c.query(
        `INSERT INTO purchase_orders (id, po_number, customer_id, reference_date, external_reference, remarks, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         RETURNING id, po_number`,
        [poId, poData.poNumber, poData.customerId, poData.referenceDate, poData.externalRef, poData.remarks]
      );
      totalPOs++;
      console.log(`Created PO: ${poRes.rows[0].po_number} (${poId})`);

      for (const scData of poData.scs) {
        // 2. Insert Sales Order Component
        const scId = randomUUID();
        await c.query(
          `INSERT INTO sales_order_components (id, sc_number, po_id, product_name, drawing_number, target_quantity, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'IN_PRODUCTION', NOW(), NOW())`,
          [scId, scData.scNumber, poId, scData.productName, scData.drawingNumber || null, scData.targetQuantity]
        );
        totalSCs++;
        console.log(`  -> Created SC: ${scData.scNumber} (Qty: ${scData.targetQuantity}) [IN_PRODUCTION]`);

        // 3. Insert RM Request
        const rmReqId = randomUUID();
        await c.query(
          `INSERT INTO rm_requests (id, po_id, sc_id, form_type, status, created_by_id, revision_number, submitted_at, completed_at, created_at, updated_at)
           VALUES ($1, $2, $3, 'SC', 'COMPLETED', $4, 1, NOW(), NOW(), NOW(), NOW())`,
          [rmReqId, poId, scId, actorId]
        );

        // 4. Insert RM Items
        const createdRmItemIds = [];
        for (const it of scData.items) {
          const rmItemId = randomUUID();
          await c.query(
            `INSERT INTO rm_items (
              id, rm_form_id, sc_id, material, material_type, grade, quantity, size,
              part_number, part_name, original_material, original_grade, original_size, original_quantity,
              weight_unit, remarks, mapped_product_id, availability_status, created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, 'ROUND_BAR', 'STANDARD', $5, $6,
              $7, $8, $9, 'STANDARD', $10, $11,
              $12, $13, $14, 'AVAILABLE', NOW(), NOW()
            )`,
            [
              rmItemId,
              rmReqId,
              scId,
              it.material,
              it.quantity,
              it.size,
              scData.scNumber,
              it.partName,
              it.originalMaterial || it.material,
              it.originalSize || it.size,
              it.quantity,
              it.unit || 'NOS',
              it.remarks || null,
              it.mappedProductId || null
            ]
          );
          createdRmItemIds.push({ id: rmItemId, quantity: it.quantity, name: it.partName, mappedProductId: it.mappedProductId || null });
          totalRmItems++;
        }

        // 5. Insert Material Issue (Stores issued)
        const issueId = randomUUID();
        const randSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
        const issueNumber = `ISS-${scData.scNumber}-${randSuffix}`;
        await c.query(
          `INSERT INTO material_issues (id, sc_id, issue_number, issue_type, issued_by_id, issue_date, remarks, created_at)
           VALUES ($1, $2, $3, 'INITIAL_ISSUE', $4, NOW(), 'Store issue for DC workflow', NOW())`,
          [issueId, scId, issueNumber, actorId]
        );

        // 6. Insert Material Issue Items
        for (const it of createdRmItemIds) {
          await c.query(
            `INSERT INTO material_issue_items (id, material_issue_id, rm_item_id, quantity_issued, issued_product_id, issued_product_name, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
            [randomUUID(), issueId, it.id, it.quantity, it.mappedProductId, it.name]
          );
        }

        // 7. Insert Material Receipt (Production received)
        const receiptId = randomUUID();
        await c.query(
          `INSERT INTO material_receipts (id, material_issue_id, received_by_id, status, remarks, received_at, created_at, updated_at)
           VALUES ($1, $2, $3, 'RECEIVED', 'Shop floor receipt confirmed against PO/SC', NOW(), NOW(), NOW())`,
          [receiptId, issueId, actorId]
        );

        // 8. Insert Material Receipt Items
        for (const it of createdRmItemIds) {
          await c.query(
            `INSERT INTO material_receipt_items (id, material_receipt_id, rm_item_id, quantity_received, remarks, created_at)
             VALUES ($1, $2, $3, $4, 'Received for production', NOW())`,
            [randomUUID(), receiptId, it.id, it.quantity]
          );
        }
      }
    }

    await c.query('COMMIT');
    console.log(`\nTransaction SUCCESS!`);
    console.log(`Inserted ${totalPOs} POs, ${totalSCs} SCs, and ${totalRmItems} RM items.`);
    console.log(`All marked as RM ISSUED by stores and PRODUCTION RECEIVED.`);
    console.log(`Zero stock deducted. DC module fully enabled.`);

  } catch (err) {
    await c.query('ROLLBACK');
    console.error('ERROR during transaction, rolled back:', err);
    throw err;
  } finally {
    await c.end();
  }
}

run().catch(console.error);

