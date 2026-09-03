# RMRIT — Roles & Permissions

## Role 1 — Junior Designer
**Can:** login · create RM · select PO · select/create SC reference · choose SC-level or PO-level RM · add materials/dimensions/quantity/optional weight · attach reference docs/photos · save draft · submit · view status · respond to rejection · view RM history.
**Cannot:** approve own RM · issue stock · confirm production receipt · complete production · modify Stores transactions.

## Role 2 — Senior Designer
**Can:** view assigned RM requests · review · modify (add/remove material, change qty/grade/size) · approve · reject with reason · review historical requests and modification history.
**Important:** major changes require an audit entry (see revision tracking).

## Role 3 — Stores Manager/User
**Can:** view approved RM · check physical/external stock · mark available/pending · issue material (partial, multiple, extra) · confirm production returns · view pending material and outstanding receipt discrepancies.
**Cannot:** maintain inventory balances inside RMRIT · approve RM · modify Design requirements.

## Role 4 — Production User
**Can:** view materials issued to production · confirm receipt (incl. partial) · record consumed/returned/wastage/damage/manufacturing-error quantities · request additional material · add reason/remarks · submit returns · view material history · complete production.

## Role 5 — Senior Manager (monitoring/analytics only)
**Can:** view all SCs, PO grouping, RM/Stores/Production status, additional material requests, exceptions, wastage, returns, discrepancies, analytics · receive notifications.
**Cannot:** approve RM · issue material · modify production records · approve additional material.

## Role 6 — Admin (full access)
- **User admin:** create/deactivate users, assign roles, reset access, manage permissions.
- **Workflow admin:** reassign users, correct exceptional records under controlled audit, view all workflows/audit logs.
- **Reporting:** global analytics, user analytics, SC analytics, PO grouping, processing time, pending material, additional requests, production performance.

## Permission Matrix
| Function | Junior | Senior Designer | Stores | Production | Senior Manager | Admin |
|---|---|---|---|---|---|---|
| Create RM | ✓ | ✓* | | | | ✓ |
| Edit own draft | ✓ | | | | | ✓ |
| Review RM | | ✓ | | | ✓ | ✓ |
| Approve RM | | ✓ | | | | ✓ |
| Reject RM | | ✓ | | | | ✓ |
| Issue Material | | | ✓ | | | ✓ |
| Confirm Receipt | | | | ✓ | | ✓ |
| Record Consumption | | | | ✓ | | ✓ |
| Record Return | | | | ✓ | | ✓ |
| Confirm Return | | | ✓ | | | ✓ |
| Additional Request | | | | ✓ | | ✓ |
| Complete Production | | | | ✓ | | ✓ |
| Analytics | Limited | Team | Stores | Own | ✓ | ✓ |
| User Management | | | | | | ✓ |
| Audit Trail | Own | Team | Own | Own | ✓ | ✓ |

`* subject to final business rule — see 10-source-doc-corrections.md`

## Security Requirements (V1 minimum)
- Auth: JWT, secure password hashing (Argon2/bcrypt), session expiration, inactive-user blocking.
- Authorization: **server-side role guards** — never rely only on hiding frontend buttons/routes. e.g. a Production user must be rejected by the server even if they hand-craft a request to `POST /admin/users`.
