# ROLE & PERMISSION ARCHITECTURE

**Status: FINAL PHASE 2.2 DESIGN**

## 1. Final Active Roles
The system operates exclusively with the following roles. `SENIOR_DESIGNER` is strictly prohibited and must not exist in any capability.

- `DESIGNER`
- `STORES`
- `PRODUCTION`
- `SENIOR_MANAGER` (Monitoring/Analytics ONLY)
- `GENERAL_MANAGER` (Monitoring/Analytics ONLY)
- `ADMIN`

## 2. Permission Matrix
This matrix defines the strict operational boundaries for each role across all major system domains. Any action not explicitly granted is inherently denied.

| Domain & Action | DESIGNER | STORES | PRODUCTION | SENIOR_MANAGER | GENERAL_MANAGER | ADMIN |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **RM REQUIREMENT** | | | | | | |
| VIEW | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| CREATE | ✓ | — | — | — | — | ✓ |
| UPDATE (Drafts) | ✓ | — | — | — | — | ✓ |
| DELETE | UNDEFINED | — | — | — | — | ✓ |
| SUBMIT | ✓ | — | — | — | — | ✓ |
| **INVENTORY** | | | | | | |
| VIEW | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| CREATE | — | UNDEFINED | — | — | — | ✓ |
| UPDATE (Adjust) | — | ✓ | — | — | — | ✓ |
| DELETE | — | — | — | — | — | UNDEFINED |
| **MATERIAL LIFECYCLE** | | | | | | |
| ISSUE | — | ✓ | — | — | — | ✓ |
| RECEIVE | — | — | ✓ | — | — | ✓ |
| CONSUME | — | — | ✓ | — | — | ✓ |
| RETURN (Submit) | — | — | ✓ | — | — | ✓ |
| RETURN (Confirm) | — | ✓ | — | — | — | ✓ |
| ADDITIONAL Request| — | — | ✓ | — | — | ✓ |
| **SC (Sub-Contract)** | | | | | | |
| COMPLETE | — | — | ✓ | — | — | ✓ |
| **SYSTEM / ADMINISTRATION**| | | | | | |
| ADMINISTER | — | — | — | — | — | ✓ |

*(Key: ✓ = Allowed, — = Denied, UNDEFINED = Requirements not yet explicitly defined)*

## 3. Special Rules
- **Monitoring Only**: `SENIOR_MANAGER` and `GENERAL_MANAGER` are exclusively observer, monitoring, and analytics roles. They are **not** approval roles and cannot block workflows.
- **Workflow Isolation**: 
  - `DESIGNER` creates and submits RM.
  - `STORES` handles all physical material issuance and inventory operations.
  - `PRODUCTION` handles physical receipt, consumption, returns, and completion.
- **Backend Authority**: The Inventory backend remains completely authoritative over stock balances. UI cannot bypass inventory validations.
- **Administration**: `ADMIN` has full administrative authority for workflow corrections, user administration, and system overrides according to defined requirements.
