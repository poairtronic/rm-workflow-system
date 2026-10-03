# Live API & Email Verification Report
*Generated At: 2026-10-03T11:15:14.654Z*

## 1. REST API Smoke & Functional Tests
- **Vendors Fetch** (`GET /api/vendors`): Status 200 [610ms] - PASS
- **Production Processes Fetch** (`GET /api/production-processes`): Status 200 [318ms] - PASS
- **Process Outward Analytics** (`GET /api/traceability/analytics/process-outward`): Status 200 [1089ms] - PASS
- **Vendor Performance Analytics** (`GET /api/traceability/vendors/performance-analytics`): Status 200 [799ms] - PASS

## 2. Email Queue & Notification Pipeline Audit
- **Create DC Type 2** (`POST /api/delivery-challans/type-2`): Status 201 [4703ms] - PASS
- **Emails Generated During Run:** 1
- **In-App Notifications Generated:** 2

### Sample Email Templates Validated
- **Event Type:** `DC_CREATED`
  - **Subject:** [RMRIT] Delivery Challan Created: DC-1791026121054
  - **Recipient:** stores-1791003078934@test.com
  - **Status:** PENDING
  - **Template Integrity Check:** PASS (Variables resolved)
- **Event Type:** `MSL_LOW_STOCK`
  - **Subject:** [RMRIT Alert] Low Stock Warning: Aero Seal Ring p20_6_1791023272764
  - **Recipient:** stores.19.6.cece9c78-a513-47d5-8ced-0d9d1458414c@test.com
  - **Status:** PENDING
  - **Template Integrity Check:** PASS (Variables resolved)
- **Event Type:** `MSL_LOW_STOCK`
  - **Subject:** [RMRIT Alert] Low Stock Warning: Aero Seal Ring p20_6_1791023272764
  - **Recipient:** stores.19.6.8c78f5a1-ad0b-4163-a9d5-b940b15dc95a@test.com
  - **Status:** PENDING
  - **Template Integrity Check:** PASS (Variables resolved)
- **Event Type:** `MSL_LOW_STOCK`
  - **Subject:** [RMRIT Alert] Low Stock Warning: Aero Seal Ring p20_6_1791023272764
  - **Recipient:** stores.19.6.692caa0d-04b1-45ca-b1d6-888c24ca8975@test.com
  - **Status:** PENDING
  - **Template Integrity Check:** PASS (Variables resolved)
- **Event Type:** `MSL_LOW_STOCK`
  - **Subject:** [RMRIT Alert] Low Stock Warning: Aero Seal Ring p20_6_1791023272764
  - **Recipient:** stores.19.6.dc1ebb76-9226-4d0a-9130-581e8b9b7edb@test.com
  - **Status:** PENDING
  - **Template Integrity Check:** PASS (Variables resolved)

### Sample In-App Notifications Validated
- **Title:** Delivery Challan Created: DC-1791026121054
  - **Message:** A new Delivery Challan DC-1791026121054 has been created for vendor N/A.
  - **Target Entity:** DELIVERY_CHALLAN (e0fea368-357e-4949-b49f-fd2be7da5256)
- **Title:** Delivery Challan Created: DC-1791026121054
  - **Message:** A new Delivery Challan DC-1791026121054 has been created for vendor N/A.
  - **Target Entity:** DELIVERY_CHALLAN (e0fea368-357e-4949-b49f-fd2be7da5256)
- **Title:** Low Stock Alert: Aero Seal Ring p20_6_1791023272764
  - **Message:** Product Aero Seal Ring p20_6_1791023272764 has dropped below Minimum Stock Level (10 / 50). Deficit: 40.
  - **Target Entity:** PRODUCT (01c7f65b-f6fc-4a60-93ac-491fb39b9852)
- **Title:** Low Stock Alert: Aero Seal Ring p20_6_1791023272764
  - **Message:** Product Aero Seal Ring p20_6_1791023272764 has dropped below Minimum Stock Level (10 / 50). Deficit: 40.
  - **Target Entity:** PRODUCT (01c7f65b-f6fc-4a60-93ac-491fb39b9852)
- **Title:** Low Stock Alert: Aero Seal Ring p20_6_1791023272764
  - **Message:** Product Aero Seal Ring p20_6_1791023272764 has dropped below Minimum Stock Level (10 / 50). Deficit: 40.
  - **Target Entity:** PRODUCT (01c7f65b-f6fc-4a60-93ac-491fb39b9852)