# Roles and Permissions Matrix

The RMRIT system defines exactly **6 roles**:

1. **`DESIGNER`**: Creates and authors raw material requirement lists.
2. **`STORES`**: Checks inventory and issues available material.
3. **`PRODUCTION`**: Confirms receipt, logs consumption/returns, requests additional material, and marks SC complete.
4. **`SENIOR_MANAGER`**: Real-time operations monitoring, alerts, and shop floor analytics (no approval gate).
5. **`GENERAL_MANAGER`**: Executive governance, organizational alerts, and throughput analytics (no approval gate).
6. **`ADMIN`**: System administration, user/role management, and audit log inspection.

---

## Operational Permission Matrix

| Capability / Action                     | ADMIN | DESIGNER | STORES | PRODUCTION | SENIOR_MANAGER | GENERAL_MANAGER |
| :-------------------------------------- | :---: | :------: | :----: | :--------: | :------------: | :-------------: |
| **Create / Edit RM List**               |   ✓   |    ✓     |   —    |     —      |       —        |        —        |
| **Submit RM List to Stores**            |   ✓   |    ✓     |   —    |     —      |       —        |        —        |
| **Check Inventory Availability**        |   ✓   |    —     |   ✓    |     —      |       —        |        —        |
| **Issue Raw Material (Initial / Addl)** |   ✓   |    —     |   ✓    |     —      |       —        |        —        |
| **Confirm Production RM Receipt**       |   ✓   |    —     |   —    |     ✓      |       —        |        —        |
| **Log Material Consumption & Returns**  |   ✓   |    —     |   —    |     ✓      |       —        |        —        |
| **Request Additional Material**         |   ✓   |    —     |   —    |     ✓      |       —        |        —        |
| **Acknowledge Returned Material**       |   ✓   |    —     |   ✓    |     —      |       —        |        —        |
| **Mark SC Complete**                    |   ✓   |    —     |   —    |     ✓      |       —        |        —        |
| **Real-time Shortage & Defect Alerts**  |   ✓   |    ✓     |   ✓    |     ✓      | ✓ (Monitoring) | ✓ (Monitoring)  |
| **View Audit Logs & Lifecycle Trail**   |   ✓   |    ✓     |   ✓    |     ✓      |       ✓        |        ✓        |
| **View Dashboards & Analytics**         |   ✓   |    ✓     |   ✓    |     ✓      |       ✓        |        ✓        |
| **User & Access Administration**        |   ✓   |    —     |   —    |     —      |       —        |        —        |
