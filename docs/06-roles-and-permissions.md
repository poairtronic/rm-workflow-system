# RMRIT — Roles & Permissions

## Role 1 — Designer (`DESIGNER`)

**Can:** login · create RM · select PO · select/create SC reference · choose SC-level or PO-level RM · add materials/dimensions/quantity/weight · save draft · submit directly to Stores · view status · edit own drafts / revisions · view RM history.
**Cannot:** issue stock · confirm production receipt · complete production · modify Stores transactions.

## Role 2 — Stores Manager (`STORES`)

**Can:** view submitted RM requests directly from Design · check physical/external stock · mark available/pending · issue material (partial, multiple, extra) · record heat/batch numbers · confirm/acknowledge production returns · view pending material shortages.
**Cannot:** maintain inventory balances inside RMRIT · modify Design requirements.

## Role 3 — Production User (`PRODUCTION`)

**Can:** view materials issued to production · confirm physical receipt (incl. partial) · record consumed/returned quantities · request additional material (with mandatory reasons) · submit returns · view material history · complete production / mark SC complete.

## Role 4 — Senior Manager (`SENIOR_MANAGER`)

**Can:** view all SCs, PO groupings, RM/Stores/Production status, additional material requests, exceptions, scrap, returns, discrepancies, analytics · receive real-time notifications and alerts.
**Cannot:** approve RM (no approval gate) · issue material · modify production records.

## Role 5 — General Manager (`GENERAL_MANAGER`)

**Can:** executive oversight, cross-departmental throughput analytics, global shortage alerts, audit trail inspection.
**Cannot:** approve RM (no approval gate) · issue material · modify operational records.

## Role 6 — Admin (`ADMIN`)

- **User admin:** create/deactivate users, assign roles, reset access, manage permissions.
- **Workflow admin:** correct exceptional records under controlled audit, view all workflows/audit logs.
- **Reporting:** global analytics, user analytics, SC analytics, PO grouping, processing time, pending material, additional requests, production performance.

---

## Permission Matrix

| Function                | Designer | Stores | Production | Senior Manager | General Manager | Admin |
| :---------------------- | :------: | :----: | :--------: | :------------: | :-------------: | :---: |
| **Create / Submit RM**  |    ✓     |   —    |     —      |       —        |        —        |   ✓   |
| **Edit Own Draft RM**   |    ✓     |   —    |     —      |       —        |        —        |   ✓   |
| **Issue Material**      |    —     |   ✓    |     —      |       —        |        —        |   ✓   |
| **Confirm RM Receipt**  |    —     |   —    |     ✓      |       —        |        —        |   ✓   |
| **Record Consumption**  |    —     |   —    |     ✓      |       —        |        —        |   ✓   |
| **Record Return**       |    —     |   —    |     ✓      |       —        |        —        |   ✓   |
| **Acknowledge Return**  |    —     |   ✓    |     —      |       —        |        —        |   ✓   |
| **Additional Request**  |    —     |   —    |     ✓      |       —        |        —        |   ✓   |
| **Complete Production** |    —     |   —    |     ✓      |       —        |        —        |   ✓   |
| **Real-time Alerts**    |    ✓     |   ✓    |     ✓      | ✓ (Monitoring) | ✓ (Monitoring)  |   ✓   |
| **Analytics & Reports** | Limited  | Stores |    Own     |       ✓        |        ✓        |   ✓   |
| **User Management**     |    —     |   —    |     —      |       —        |        —        |   ✓   |
| **Audit Trail**         |   Own    |  Own   |    Own     |       ✓        |        ✓        |   ✓   |

---

## Security Requirements

- Auth: JWT, secure password hashing (bcrypt), session expiration, inactive-user blocking.
- Authorization: **server-side role guards** (`JwtAuthGuard`, `RolesGuard`).
