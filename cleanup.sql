-- Cleanup Script
BEGIN;

-- 1. Remove DC Type 1 & 2 Items
DELETE FROM delivery_challan_items 
WHERE challan_id IN ('1bd8503d-4eeb-4f2d-ac0b-2208e1887ab3', '859215d2-8e45-499c-b65f-62b5879e74b7');

-- 2. Remove DCs
DELETE FROM delivery_challans 
WHERE id IN ('1bd8503d-4eeb-4f2d-ac0b-2208e1887ab3', '859215d2-8e45-499c-b65f-62b5879e74b7');

-- 3. Remove Stock Transactions
DELETE FROM stock_transactions 
WHERE reference_id IN ('1bd8503d-4eeb-4f2d-ac0b-2208e1887ab3', '859215d2-8e45-499c-b65f-62b5879e74b7');

-- 4. Re-credit deducted stock balances
UPDATE stock_balances 
SET current_quantity = current_quantity + 3 
WHERE product_id = '01c7f65b-f6fc-4a60-93ac-491fb39b9852' AND bin_id = '8a69c8a4-7c5c-4d6d-a0af-4948c2d12cea';

UPDATE stock_balances 
SET current_quantity = current_quantity + 1 
WHERE product_id = 'dbfab27a-22ab-409a-9724-8596567608cb' AND bin_id = '8a69c8a4-7c5c-4d6d-a0af-4948c2d12cea';

-- 5. Remove Process Master
DELETE FROM production_processes 
WHERE code = 'PRC-TEST-001';

-- Inspect the rows and then issue COMMIT manually if acceptable
-- ROLLBACK;
-- COMMIT;
