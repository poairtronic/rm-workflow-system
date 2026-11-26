-- ============================================================
-- FORCE DELETE DUPLICATE PRODUCTS SCRIPT
-- Generated: 2026-11-26
-- WARNING: This is IRREVERSIBLE. All linked history will be
-- permanently deleted. Take a DB backup before running.
-- ============================================================

BEGIN;

-- Step 1: Collect IDs of the duplicate products by their codes
CREATE TEMP TABLE _dup_product_ids AS
SELECT id, code, name
FROM products
WHERE code IN (
  'PRD-M6 MALE 2A',
  'PRD-R1.4',
  'PRD-R1',
  'PRD-KD 22 SEMI FINISHED',
  'PRD-KD 22 WITH HOLE',
  'PRD-R 2.2',
  'PRD-R 2.3',
  'PRD-R 2.4',
  'PRD-EN31 DIA 8 FINE BLANK',
  'PRD-EN31 DIA 9 FINE BLANK',
  'PRD-R 4.1',
  'PRD-R 4.2',
  'PRD-R 4.3',
  'PRD-KD 50 SEMI FINISHED',
  'PRD-R 6 .1',
  'PRD-R 6.2',
  'PRD-R 6.3',
  'PRD-EN31 DIA 17 CUT PIECE',
  'PRD-EN31 DIA 17 FINE BLANK',
  'PRD-R 9.1',
  'PRD-R 9.2',
  'PRD-R 9.3',
  'PRD-R 11.1',
  'PRD-EN31 DIA 31 FINE BLANK',
  'PRD-R 13.1',
  'PRD-R 14.2',
  'PRD-EN31 DIA 43 FINE BLANK',
  'PRD-EN31 DIA 43 SEMI FINISHED',
  'PRD-EN31 DIA 48 FINE BLANK',
  'PRD-R 17.1',
  'PRD-EN31 DIA 59 SEMI FINISHED',
  'PRD-EN31 DIA 65 FINE BLANK',
  'PRD-R 20.1',
  'PRD-R 25.1',
  'PRD-EN31 DIA 60 FINE BLANK',
  'PRD-ARG ID 6 TO 15 OD 55- FB',
  'PRD-ARG ID 6 TO 15 OD 55- SF',
  'PRD-DIA 33.5 APG SF BENCH MOUNT',
  'PRD-EN31 DIA 105 FINE BLANK',
  'PRD-ARG ID 25 TO 40 OD 74 SEMI FINISHED',
  'PRD-ARG ID 25 TO 40 OD 80 SEMI FINISHED',
  'PRD-R 43.1',
  'PRD-R 43.2',
  'PRD-R 43.3',
  'PRD-ARG ID 130 OD 130 THICKNESS 30',
  'PRD-ARG OD 120 -FB',
  'PRD-ARG OD 170 -FB',
  'PRD-R 46.1',
  'PRD-R 46.2',
  'PRD-R 46.3',
  'PRD-KD 63 FINE BLANK',
  'PRD-EN31 DIA 55 FINE BLANK',
  'PRD-DIA 110 ARG FB WH',
  'PRD-DIA 110 ARG SF',
  'PRD-JIG FEET',
  'PRD-Drill Bit',
  'PRD-EXTENSTION DIA 10 TO 15 (L=25)',
  'PRD-EAR PLUGS',
  'PRD-EXTENSTION DIA 15 TO 20 (L=25)',
  'PRD-EXTENSTION DIA 20 TO 35 (L=25)',
  'PRD-Emery Wheel',
  'PRD-EXTENSTION DIA 35 TO 60 (L=25)',
  'PRD-Gloves',
  'PRD-EXTENSTION DIA 10 TO 15 (L=50)',
  'PRD-Hacksaw Blade',
  'PRD-EXTENSTION DIA 15 TO 20 (L=50)',
  'PRD-Hydralic oil',
  'PRD-EXTENSTION DIA 20 TO 35 (L=50)',
  'PRD-Machine oil',
  'PRD-EXTENSTION DIA 35 TO 60 (L=50)',
  'PRD-IS-8 2 SIDE',
  'PRD-I.S NO:9 SINGLE SIDE',
  'PRD-I.S NO:6 DOUBLE SIDE',
  'PRD-I.S NO:4 DOUBLE SIDE',
  'PRD-I.S NO:5 DOUBLE SIDE',
  'PRD-I.S NO:2',
  'PRD-I.S NO:3',
  'PRD-I.S NYLON HANDLE'
);

-- Show what we found (for verification)
SELECT '=== Products found to delete ===' AS info;
SELECT id, code, name FROM _dup_product_ids ORDER BY code;

-- Step 2: Delete in correct FK dependency order

-- 2a. MSL alerts
DELETE FROM msl_alerts
WHERE product_id IN (SELECT id FROM _dup_product_ids);

-- 2b. Stock balances
DELETE FROM stock_balances
WHERE product_id IN (SELECT id FROM _dup_product_ids);

-- 2c. Stock transactions
DELETE FROM stock_transactions
WHERE product_id IN (SELECT id FROM _dup_product_ids);

-- 2d. Consumable request items (unfulfilled + fulfilled)
DELETE FROM consumable_request_items
WHERE product_id IN (SELECT id FROM _dup_product_ids);

-- 2e. General issue items
DELETE FROM general_issue_items
WHERE product_id IN (SELECT id FROM _dup_product_ids);

-- 2f. Delivery challan items (product_id & output_product_id)
DELETE FROM delivery_challan_items
WHERE product_id IN (SELECT id FROM _dup_product_ids)
   OR output_product_id IN (SELECT id FROM _dup_product_ids);

-- 2g. DC movements
DELETE FROM dc_movements
WHERE dispatched_product_id IN (SELECT id FROM _dup_product_ids)
   OR returned_product_id IN (SELECT id FROM _dup_product_ids);

-- 2h. DC rework items
DELETE FROM dc_rework_items
WHERE product_id IN (SELECT id FROM _dup_product_ids);

-- 2i. RM items (mapped_product_id)
UPDATE rm_items
SET mapped_product_id = NULL
WHERE mapped_product_id IN (SELECT id FROM _dup_product_ids);

-- 2j. Merc indent line items (rm_product_id)
UPDATE merc_indent_line_items
SET rm_product_id = NULL
WHERE rm_product_id IN (SELECT id FROM _dup_product_ids);

-- 2k. Material issue items (issued_product_id — stored as varchar, cast needed)
UPDATE material_issue_items
SET issued_product_id = NULL
WHERE issued_product_id::uuid IN (SELECT id FROM _dup_product_ids);

-- Step 3: Finally delete the products themselves
DELETE FROM products
WHERE id IN (SELECT id FROM _dup_product_ids);

-- Step 4: Confirm deletion
SELECT '=== Deletion complete. Remaining count ===' AS info;
SELECT COUNT(*) AS remaining_duplicate_products
FROM products
WHERE code IN (
  'PRD-M6 MALE 2A','PRD-R1.4','PRD-R1','PRD-KD 22 SEMI FINISHED',
  'PRD-KD 22 WITH HOLE','PRD-R 2.2','PRD-R 2.3','PRD-R 2.4',
  'PRD-EN31 DIA 8 FINE BLANK','PRD-EN31 DIA 9 FINE BLANK',
  'PRD-R 4.1','PRD-R 4.2','PRD-R 4.3','PRD-KD 50 SEMI FINISHED',
  'PRD-R 6 .1','PRD-R 6.2','PRD-R 6.3','PRD-EN31 DIA 17 CUT PIECE',
  'PRD-EN31 DIA 17 FINE BLANK','PRD-R 9.1','PRD-R 9.2','PRD-R 9.3',
  'PRD-R 11.1','PRD-EN31 DIA 31 FINE BLANK','PRD-R 13.1','PRD-R 14.2',
  'PRD-EN31 DIA 43 FINE BLANK','PRD-EN31 DIA 43 SEMI FINISHED',
  'PRD-EN31 DIA 48 FINE BLANK','PRD-R 17.1','PRD-EN31 DIA 59 SEMI FINISHED',
  'PRD-EN31 DIA 65 FINE BLANK','PRD-R 20.1','PRD-R 25.1',
  'PRD-EN31 DIA 60 FINE BLANK','PRD-ARG ID 6 TO 15 OD 55- FB',
  'PRD-ARG ID 6 TO 15 OD 55- SF','PRD-DIA 33.5 APG SF BENCH MOUNT',
  'PRD-EN31 DIA 105 FINE BLANK','PRD-ARG ID 25 TO 40 OD 74 SEMI FINISHED',
  'PRD-ARG ID 25 TO 40 OD 80 SEMI FINISHED','PRD-R 43.1','PRD-R 43.2',
  'PRD-R 43.3','PRD-ARG ID 130 OD 130 THICKNESS 30','PRD-ARG OD 120 -FB',
  'PRD-ARG OD 170 -FB','PRD-R 46.1','PRD-R 46.2','PRD-R 46.3',
  'PRD-KD 63 FINE BLANK','PRD-EN31 DIA 55 FINE BLANK','PRD-DIA 110 ARG FB WH',
  'PRD-DIA 110 ARG SF','PRD-JIG FEET','PRD-Drill Bit',
  'PRD-EXTENSTION DIA 10 TO 15 (L=25)','PRD-EAR PLUGS',
  'PRD-EXTENSTION DIA 15 TO 20 (L=25)','PRD-EXTENSTION DIA 20 TO 35 (L=25)',
  'PRD-Emery Wheel','PRD-EXTENSTION DIA 35 TO 60 (L=25)','PRD-Gloves',
  'PRD-EXTENSTION DIA 10 TO 15 (L=50)','PRD-Hacksaw Blade',
  'PRD-EXTENSTION DIA 15 TO 20 (L=50)','PRD-Hydralic oil',
  'PRD-EXTENSTION DIA 20 TO 35 (L=50)','PRD-Machine oil',
  'PRD-EXTENSTION DIA 35 TO 60 (L=50)','PRD-IS-8 2 SIDE',
  'PRD-I.S NO:9 SINGLE SIDE','PRD-I.S NO:6 DOUBLE SIDE',
  'PRD-I.S NO:4 DOUBLE SIDE','PRD-I.S NO:5 DOUBLE SIDE',
  'PRD-I.S NO:2','PRD-I.S NO:3','PRD-I.S NYLON HANDLE'
);

COMMIT;
-- If anything went wrong above, run ROLLBACK; instead of COMMIT;
