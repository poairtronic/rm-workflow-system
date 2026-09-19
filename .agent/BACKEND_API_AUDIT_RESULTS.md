# BACKEND API COMPREHENSIVE HTTP AUDIT RESULTS

## 1. Executive Summary
Total Discovered: 89
Total Tested: 89
PASS: 87
FAIL: 2
PARTIAL: 0
BLOCKED: 0
NOT IMPLEMENTED: 0
NOT TESTED: 0

## 2. Module Summary
| Module | Endpoints | Tested | PASS | FAIL | PARTIAL | BLOCKED | NOT TESTED |
|---|---|---|---|---|---|---|---|
| AdditionalRequests | 3 | 3 | 3 | 0 | 0 | 0 | 0 |
| StatusMonitoring | 2 | 2 | 2 | 0 | 0 | 0 | 0 |
| Other | 13 | 13 | 13 | 0 | 0 | 0 | 0 |
| Auth | 4 | 4 | 4 | 0 | 0 | 0 | 0 |
| Inventory | 13 | 13 | 12 | 1 | 0 | 0 | 0 |
| Bins | 5 | 5 | 5 | 0 | 0 | 0 | 0 |
| Categories | 5 | 5 | 5 | 0 | 0 | 0 | 0 |
| Families | 5 | 5 | 5 | 0 | 0 | 0 | 0 |
| Locations | 5 | 5 | 5 | 0 | 0 | 0 | 0 |
| Products | 9 | 9 | 9 | 0 | 0 | 0 | 0 |
| Racks | 5 | 5 | 5 | 0 | 0 | 0 | 0 |
| Warehouses | 5 | 5 | 5 | 0 | 0 | 0 | 0 |
| MaterialIssues | 3 | 3 | 3 | 0 | 0 | 0 | 0 |
| MaterialReturns | 1 | 1 | 1 | 0 | 0 | 0 | 0 |
| SalesContracts | 5 | 5 | 4 | 1 | 0 | 0 | 0 |
| Users | 6 | 6 | 6 | 0 | 0 | 0 | 0 |

## 3. Failed Endpoints
### API-018 - GET /api/inventory/:id/reconciliation
- **Controller**: InventoryController
- **Notes**: N/A

### API-078 - POST /api/sc
- **Controller**: ScController
- **Notes**: N/A


## 4. API Inventory Status
| ID | Method | Path | Controller | Result |
|---|---|---|---|---|
| API-001 | POST | /api/additional-requests | AdditionalRequestController | PASS |
| API-002 | GET | /api/additional-requests | AdditionalRequestController | PASS |
| API-003 | GET | /api/additional-requests/:id | AdditionalRequestController | PASS |
| API-004 | GET | /api/analytics/status | AnalyticsController | PASS |
| API-005 | GET |  | AppController | PASS |
| API-006 | GET | /api/health | AppController | PASS |
| API-007 | GET | /api/audit/status | AuditController | PASS |
| API-008 | POST | /api/auth/login | AuthController | PASS |
| API-009 | GET | /api/auth/roles | AuthController | PASS |
| API-010 | POST | /api/auth/dev-token | AuthController | PASS |
| API-011 | GET | /api/auth/me | AuthController | PASS |
| API-012 | GET | /api/customers/status | CustomersController | PASS |
| API-013 | POST | /api/inventory | InventoryController | PASS |
| API-014 | GET | /api/inventory | InventoryController | PASS |
| API-015 | GET | /api/inventory/reconciliation | InventoryController | PASS |
| API-016 | GET | /api/inventory/reconciliation/workflow | InventoryController | PASS |
| API-017 | GET | /api/inventory/:id | InventoryController | PASS |
| API-018 | GET | /api/inventory/:id/reconciliation | InventoryController | FAIL |
| API-019 | PATCH | /api/inventory/:id | InventoryController | PASS |
| API-020 | GET | /api/inventory/:id/stock | InventoryController | PASS |
| API-021 | GET | /api/inventory/:id/transactions | InventoryController | PASS |
| API-022 | POST | /api/inventory/:id/stock-in | InventoryController | PASS |
| API-023 | POST | /api/inventory/:id/stock-out | InventoryController | PASS |
| API-024 | POST | /api/inventory/:id/adjustment | InventoryController | PASS |
| API-025 | POST | /api/inventory/:id/transactions | InventoryController | PASS |
| API-026 | GET | /api/bins | BinsController | PASS |
| API-027 | GET | /api/bins/:id | BinsController | PASS |
| API-028 | POST | /api/bins | BinsController | PASS |
| API-029 | PATCH | /api/bins/:id | BinsController | PASS |
| API-030 | DELETE | /api/bins/:id | BinsController | PASS |
| API-031 | GET | /api/categories | CategoriesController | PASS |
| API-032 | GET | /api/categories/:id | CategoriesController | PASS |
| API-033 | POST | /api/categories | CategoriesController | PASS |
| API-034 | PATCH | /api/categories/:id | CategoriesController | PASS |
| API-035 | DELETE | /api/categories/:id | CategoriesController | PASS |
| API-036 | GET | /api/families | FamiliesController | PASS |
| API-037 | GET | /api/families/:id | FamiliesController | PASS |
| API-038 | POST | /api/families | FamiliesController | PASS |
| API-039 | PATCH | /api/families/:id | FamiliesController | PASS |
| API-040 | DELETE | /api/families/:id | FamiliesController | PASS |
| API-041 | GET | /api/locations | LocationsController | PASS |
| API-042 | GET | /api/locations/:id | LocationsController | PASS |
| API-043 | POST | /api/locations | LocationsController | PASS |
| API-044 | PATCH | /api/locations/:id | LocationsController | PASS |
| API-045 | DELETE | /api/locations/:id | LocationsController | PASS |
| API-046 | GET | /api/products | ProductsController | PASS |
| API-047 | GET | /api/products/:id | ProductsController | PASS |
| API-048 | POST | /api/products | ProductsController | PASS |
| API-049 | PATCH | /api/products/:id | ProductsController | PASS |
| API-050 | GET | /api/racks | RacksController | PASS |
| API-051 | GET | /api/racks/:id | RacksController | PASS |
| API-052 | POST | /api/racks | RacksController | PASS |
| API-053 | PATCH | /api/racks/:id | RacksController | PASS |
| API-054 | DELETE | /api/racks/:id | RacksController | PASS |
| API-055 | GET | /api/warehouses | WarehousesController | PASS |
| API-056 | GET | /api/warehouses/:id | WarehousesController | PASS |
| API-057 | POST | /api/warehouses | WarehousesController | PASS |
| API-058 | PATCH | /api/warehouses/:id | WarehousesController | PASS |
| API-059 | DELETE | /api/warehouses/:id | WarehousesController | PASS |
| API-060 | POST | /api/material-issues | MaterialIssueController | PASS |
| API-061 | GET | /api/material-issues | MaterialIssueController | PASS |
| API-062 | GET | /api/material-issues/:id | MaterialIssueController | PASS |
| API-063 | GET | /api/material-movement/status | MaterialMovementController | PASS |
| API-064 | GET | /api/notifications/status | NotificationsController | PASS |
| API-065 | GET | /api/permissions/status | PermissionsController | PASS |
| API-066 | GET | /api/po/status | PoController | PASS |
| API-067 | POST | /api/production/receipt | ProductionController | PASS |
| API-068 | POST | /api/production/consume | ProductionController | PASS |
| API-069 | POST | /api/production/return | ProductionController | PASS |
| API-070 | POST | /api/production/return/:id/verify | ProductionController | PASS |
| API-071 | GET | /api/production/accounting/:scId | ProductionController | PASS |
| API-072 | POST | /api/rm | RmController | PASS |
| API-073 | POST | /api/rm/:id/items | RmController | PASS |
| API-074 | POST | /api/rm/:id/submit | RmController | PASS |
| API-075 | GET | /api/rm | RmController | PASS |
| API-076 | GET | /api/rm/:id | RmController | PASS |
| API-077 | GET | /api/roles/status | RolesController | PASS |
| API-078 | POST | /api/sc | ScController | FAIL |
| API-079 | GET | /api/sc | ScController | PASS |
| API-080 | GET | /api/sc/:id | ScController | PASS |
| API-081 | POST | /api/sc/:id/complete | ScController | PASS |
| API-082 | POST | /api/sc/:id/close | ScController | PASS |
| API-083 | GET | /api/stores/status | StoresController | PASS |
| API-084 | POST | /api/users | UsersController | PASS |
| API-085 | GET | /api/users | UsersController | PASS |
| API-086 | GET | /api/users/:id | UsersController | PASS |
| API-087 | PUT | /api/users/:id | UsersController | PASS |
| API-088 | PATCH | /api/users/:id/activate | UsersController | PASS |
| API-089 | PATCH | /api/users/:id/deactivate | UsersController | PASS |
