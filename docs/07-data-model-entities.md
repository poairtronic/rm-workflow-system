# RMRIT — Data Model & Core Entities

## Conceptual Structure
```
User
 ├── PO
 │    └── SC
 │         └── RMRequest
 │              ├── RMItem
 │              │    ├── Attachments
 │              │    ├── Approval/Revisions
 │              │    ├── Issue Transactions
 │              │    ├── Receipt Transactions
 │              │    ├── Additional Requests
 │              │    ├── Consumption
 │              │    ├── Returns
 │              │    ├── Exceptions
 │              │    └── Audit History
 └── Analytics
```

## Core Entities

### User
`id, name, email, passwordHash, role, isActive, createdAt, updatedAt`

### Customer
`id, name, code, isActive`

### PO
`id, poNumber, customerId, createdAt, updatedAt`

### SC
`id, poId, scNumber, status, createdAt, updatedAt, completedAt`

### RMRequest
`id, scId, requestType, createdById, status, submittedAt, approvedAt, createdAt, updatedAt`

### RMItem
`id, rmRequestId, materialGrade, size, quantity, unit, length, width, thickness, diameter, weight, remarks`
(Only `materialGrade`, `size`, `quantity` are strictly always required — see flexible-dimensions rule in doc 02.)

## Transaction Entities (append-only — never overwrite prior rows)

### MaterialIssue
`id, rmItemId, quantity, issueType, issuedBy, issuedAt, remarks`
`issueType ∈ { NORMAL, ADDITIONAL, EXTRA }`

### ProductionReceipt
`id, issueId, quantity, receivedBy, receivedAt, remarks`

### ProductionConsumption
`id, rmItemId, quantity, recordedBy, recordedAt, remarks`

### MaterialReturn
`id, rmItemId, quantity, returnedBy, returnedAt, confirmedBy, confirmedAt, status, remarks`

### ProductionException
`id, rmItemId, type, quantity, reason, remarks, createdBy, createdAt`
`type ∈ { WASTAGE, DAMAGE, MANUFACTURING_ERROR }`

### AdditionalMaterialRequest
`id, scId, createdBy, reason, status, createdAt` (has its own RM items)

## Audit / Revision Entities

### RM Revision
`fieldChanged, oldValue, newValue, changedBy, changedAt, reason`

### AuditLog
`user, action, entity, entityId, oldData, newData, timestamp, ipOrDeviceInfo(optional)`

Built on the original design's `StatusHistory` / `ApprovalLog` philosophy: nothing is ever silently overwritten.

## Data Integrity Rules (server-side, authoritative — frontend only displays)
```
Pending Issue                      = Required - Total Issued
Receipt Pending                    = Total Issued - Total Received
Unaccounted Production Material    = Total Received - Consumed - Returned - Exceptions
```

## Transaction Safety
A Stores issue action must be atomic — e.g. `Create Issue + Update Item Status + Create Notification + Create Audit Entry` happen in one DB transaction (all-or-nothing).

## Idempotency
Guard against double-submit (e.g. double-clicking "Issue Material" must not create two separate issue rows for one intended action).

## Attachments
Files (reference photos/docs) are stored externally (Supabase Storage), never as binary blobs inside PostgreSQL. RM Request stores only the URL/Storage ID.

## Recommended Indexes
```
PO.poNumber
SC.poId
SC.scNumber
RMRequest.scId
RMRequest.status
RMItem.rmRequestId
MaterialIssue.rmItemId
ProductionReceipt.issueId
AdditionalMaterialRequest.scId
Notification.userId
Notification.isRead
AuditLog.entityId
```
