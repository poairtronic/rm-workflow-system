# RMRIT — Data Model & Core Entities

## Conceptual Structure

```text
User
 ├── PO
 │    └── SC
 │         └── RMRequest
 │              ├── RMItem
 │              │    ├── Revisions / Snapshots
 │              │    ├── Issue Transactions
 │              │    ├── Receipt Transactions
 │              │    ├── Additional Requests
 │              │    ├── Consumption
 │              │    ├── Returns
 │              │    └── Audit History
 └── Analytics
```

## Core Entities (20 Tables)

### User
`id, name, email, passwordHash, role, department, isActive, createdAt, updatedAt`

### Customer
`id, name, code, contactPerson, email, phone, isActive`

### PO
`id, poNumber, customerId, referenceDate, remarks, createdAt, updatedAt`

### SC
`id, poId, scNumber, productName, targetQuantity, status, completedAt, completedById, completionRemarks`

### RMRequest
`id, poId, scId, formType, createdById, status, revisionNumber, submittedAt, completedAt, remarks`

### RMItem
`id, rmFormId, scId, material, materialType, grade, size, quantity, length, width, thickness, diameter, weight, weightUnit, remarks`

### RMItemSnapshot
`id, rmItemId, rmFormId, revisionNumber, changeType, changedById, material, materialType, grade, size, quantity, revisionReason, createdAt`

### MaterialIssue
`id, scId, additionalRequestId, issueNumber, issueType, issuedById, issueDate, status, remarks`

### MaterialIssueItem
`id, materialIssueId, rmItemId, quantityIssued, heatNumber, batchNumber, remarks`

### MaterialReceipt
`id, scId, materialIssueId, receivedById, receivedAt, status, remarks`

### MaterialReceiptItem
`id, materialReceiptId, rmItemId, quantityReceived, discrepancyReason`

### MaterialConsumption
`id, scId, rmItemId, operatorId, consumedQuantity, operationStage, machineId, loggedAt, remarks`

### MaterialReturn
`id, scId, returnedById, returnedAt, status, acknowledgedById, acknowledgedAt, remarks`

### MaterialReturnItem
`id, materialReturnId, rmItemId, quantityReturned, condition`

### AdditionalMaterialRequest
`id, scId, requestedById, status, reason, remarks, requestedAt, approvedAt, approvedById`

### AdditionalMaterialRequestItem
`id, requestId, rmItemId, quantityRequested, quantityApproved, remarks`

### Notification
`id, userId, title, message, type, targetEntity, targetId, isRead, createdAt`

### AuditLog
`id, entityName, entityId, actionType, actorId, oldValues, newValues, metadata, createdAt`
