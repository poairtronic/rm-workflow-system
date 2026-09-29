# RMRIT Requirement Traceability Matrix

| Req ID | Requirement | Phase | Current Status | Existing Component | New Component | Backend | Frontend | Certification |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **REQ-001** | General inventory issue without SC/PO | 17 | 🟡 PARTIAL | `StockOut` / `StockTransaction` | General Issue UI, Validator | Not Started | Not Started | Not Started |
| **REQ-002** | MSL low-stock / out-of-stock evaluation | 17 | 🟡 PARTIAL | `minimum_inventory` field | MSL Evaluation Engine | Not Started | Not Started | Not Started |
| **REQ-003** | MSL Notifications & Email | 17 | 🔴 NOT DEVELOPED | Email Queue, Notif Model | Event Trigger & Templates | Not Started | Not Started | Not Started |
| **REQ-004** | Production Process Master (1..N sequence) | 18 | 🔴 NOT DEVELOPED | Production Tracking | ProcessMaster Entity | Not Started | Not Started | Not Started |
| **REQ-005** | Vendor Master & Capability Mapping | 19 | 🔴 NOT DEVELOPED | RBAC / Auth | Vendor Entity, SLA Rules | Not Started | Not Started | Not Started |
| **REQ-006** | DC Type 1 (Production Process Outward) | 20 | 🔴 NOT DEVELOPED | SC/PO, Prod Process | DeliveryChallan Entity | Not Started | Not Started | Not Started |
| **REQ-007** | DC Type 2 (General Inventory Outward) | 20 | 🔴 NOT DEVELOPED | Inventory Hierarchy | DeliveryChallan Entity | Not Started | Not Started | Not Started |
| **REQ-008** | DC Return & Closure (Full/Partial) | 21 | 🔴 NOT DEVELOPED | DC Entity | Return Verification Logic | Not Started | Not Started | Not Started |
| **REQ-009** | DC SLA & Overdue Notification | 21 | 🔴 NOT DEVELOPED | Email/Notif Engine | SLA Cron/Trigger Logic | Not Started | Not Started | Not Started |
| **REQ-010** | SC Traceability (Open/Closed RM, Final Used) | 22 | 🟡 PARTIAL | Raw RM/Stock Data | Aggregation APIs | Not Started | Not Started | Not Started |
| **REQ-011** | PO Traceability (Consolidated views) | 23 | 🟡 PARTIAL | PO/SC raw records | Aggregation APIs | Not Started | Not Started | Not Started |
| **REQ-012** | Vendor/DC Analytics Dashboard | 24 | 🔴 NOT DEVELOPED | Vendor/DC data | Analytics APIs | Not Started | Not Started | Not Started |
