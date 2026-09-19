# Backend API Inventory

| ID | Method | Path | Controller | Auth | Roles | Test Type | Status | Result |
|---|---|---|---|---|---|---|---|---|
| API-001 | POST | /api/additional-requests | AdditionalRequestController | JWT | UserPRODUCTION, UserDESIGNER, UserADMIN | HTTP | PENDING | NOT TESTED |
| API-002 | GET | /api/additional-requests | AdditionalRequestController | JWT | - | HTTP | PENDING | NOT TESTED |
| API-003 | GET | /api/additional-requests/:id | AdditionalRequestController | JWT | - | HTTP | PENDING | NOT TESTED |
| API-004 | GET | /api/analytics/status | AnalyticsController | JWT | - | HTTP | PENDING | NOT TESTED |
| API-005 | GET |  | AppController | JWT | - | HTTP | PENDING | NOT TESTED |
| API-006 | GET | /api/health | AppController | JWT | - | HTTP | PENDING | NOT TESTED |
| API-007 | GET | /api/audit/status | AuditController | JWT | - | HTTP | PENDING | NOT TESTED |
| API-008 | POST | /api/auth/login | AuthController | JWT | - | HTTP | PENDING | NOT TESTED |
| API-009 | GET | /api/auth/roles | AuthController | JWT | - | HTTP | PENDING | NOT TESTED |
| API-010 | POST | /api/auth/dev-token | AuthController | JWT | - | HTTP | PENDING | NOT TESTED |
| API-011 | GET | /api/auth/me | AuthController | JWT | - | HTTP | PENDING | NOT TESTED |
| API-012 | GET | /api/customers/status | CustomersController | JWT | - | HTTP | PENDING | NOT TESTED |
| API-013 | POST | /api/inventory | InventoryController | JWT | UserSTORES, UserADMIN | HTTP | PENDING | NOT TESTED |
| API-014 | GET | /api/inventory | InventoryController | JWT | - | HTTP | PENDING | NOT TESTED |
| API-015 | GET | /api/inventory/reconciliation | InventoryController | JWT | UserSTORES, UserADMIN, UserDESIGNER, UserSENIOR_MANAGER, UserGENERAL_MANAGER | HTTP | PENDING | NOT TESTED |
| API-016 | GET | /api/inventory/reconciliation/workflow | InventoryController | JWT | UserSTORES, UserADMIN, UserSENIOR_MANAGER, UserGENERAL_MANAGER | HTTP | PENDING | NOT TESTED |
| API-017 | GET | /api/inventory/:id | InventoryController | JWT | - | HTTP | PENDING | NOT TESTED |
| API-018 | GET | /api/inventory/:id/reconciliation | InventoryController | JWT | UserSTORES, UserADMIN, UserDESIGNER, UserSENIOR_MANAGER, UserGENERAL_MANAGER | HTTP | PENDING | NOT TESTED |
| API-019 | PATCH | /api/inventory/:id | InventoryController | JWT | UserSTORES, UserADMIN | HTTP | PENDING | NOT TESTED |
| API-020 | GET | /api/inventory/:id/stock | InventoryController | JWT | - | HTTP | PENDING | NOT TESTED |
| API-021 | GET | /api/inventory/:id/transactions | InventoryController | JWT | UserSTORES, UserADMIN, UserSENIOR_MANAGER, UserGENERAL_MANAGER | HTTP | PENDING | NOT TESTED |
| API-022 | POST | /api/inventory/:id/stock-in | InventoryController | JWT | UserSTORES, UserADMIN | HTTP | PENDING | NOT TESTED |
| API-023 | POST | /api/inventory/:id/stock-out | InventoryController | JWT | UserSTORES, UserADMIN | HTTP | PENDING | NOT TESTED |
| API-024 | POST | /api/inventory/:id/adjustment | InventoryController | JWT | UserSTORES, UserADMIN | HTTP | PENDING | NOT TESTED |
| API-025 | POST | /api/inventory/:id/transactions | InventoryController | JWT | UserSTORES, UserADMIN | HTTP | PENDING | NOT TESTED |
| API-026 | GET | /api/bins | BinsController | JWT | - | HTTP | PENDING | NOT TESTED |
| API-027 | GET | /api/bins/:id | BinsController | JWT | - | HTTP | PENDING | NOT TESTED |
| API-028 | POST | /api/bins | BinsController | JWT | UserADMIN, UserSTORES | HTTP | PENDING | NOT TESTED |
| API-029 | PATCH | /api/bins/:id | BinsController | JWT | UserADMIN, UserSTORES | HTTP | PENDING | NOT TESTED |
| API-030 | DELETE | /api/bins/:id | BinsController | JWT | UserADMIN, UserSTORES | HTTP | PENDING | NOT TESTED |
| API-031 | GET | /api/categories | CategoriesController | JWT | - | HTTP | PENDING | NOT TESTED |
| API-032 | GET | /api/categories/:id | CategoriesController | JWT | - | HTTP | PENDING | NOT TESTED |
| API-033 | POST | /api/categories | CategoriesController | JWT | UserADMIN, UserSTORES | HTTP | PENDING | NOT TESTED |
| API-034 | PATCH | /api/categories/:id | CategoriesController | JWT | UserADMIN, UserSTORES | HTTP | PENDING | NOT TESTED |
| API-035 | DELETE | /api/categories/:id | CategoriesController | JWT | UserADMIN, UserSTORES | HTTP | PENDING | NOT TESTED |
| API-036 | GET | /api/families | FamiliesController | JWT | - | HTTP | PENDING | NOT TESTED |
| API-037 | GET | /api/families/:id | FamiliesController | JWT | - | HTTP | PENDING | NOT TESTED |
| API-038 | POST | /api/families | FamiliesController | JWT | UserADMIN, UserSTORES | HTTP | PENDING | NOT TESTED |
| API-039 | PATCH | /api/families/:id | FamiliesController | JWT | UserADMIN, UserSTORES | HTTP | PENDING | NOT TESTED |
| API-040 | DELETE | /api/families/:id | FamiliesController | JWT | UserADMIN, UserSTORES | HTTP | PENDING | NOT TESTED |
| API-041 | GET | /api/locations | LocationsController | JWT | - | HTTP | PENDING | NOT TESTED |
| API-042 | GET | /api/locations/:id | LocationsController | JWT | - | HTTP | PENDING | NOT TESTED |
| API-043 | POST | /api/locations | LocationsController | JWT | UserADMIN, UserSTORES | HTTP | PENDING | NOT TESTED |
| API-044 | PATCH | /api/locations/:id | LocationsController | JWT | UserADMIN, UserSTORES | HTTP | PENDING | NOT TESTED |
| API-045 | DELETE | /api/locations/:id | LocationsController | JWT | UserADMIN, UserSTORES | HTTP | PENDING | NOT TESTED |
| API-046 | GET | /api/products | ProductsController | JWT | - | HTTP | PENDING | NOT TESTED |
| API-047 | GET | /api/products/:id | ProductsController | JWT | - | HTTP | PENDING | NOT TESTED |
| API-048 | POST | /api/products | ProductsController | JWT | UserADMIN, UserSTORES | HTTP | PENDING | NOT TESTED |
| API-049 | PATCH | /api/products/:id | ProductsController | JWT | UserADMIN, UserSTORES | HTTP | PENDING | NOT TESTED |
| API-050 | GET | /api/racks | RacksController | JWT | - | HTTP | PENDING | NOT TESTED |
| API-051 | GET | /api/racks/:id | RacksController | JWT | - | HTTP | PENDING | NOT TESTED |
| API-052 | POST | /api/racks | RacksController | JWT | UserADMIN, UserSTORES | HTTP | PENDING | NOT TESTED |
| API-053 | PATCH | /api/racks/:id | RacksController | JWT | UserADMIN, UserSTORES | HTTP | PENDING | NOT TESTED |
| API-054 | DELETE | /api/racks/:id | RacksController | JWT | UserADMIN, UserSTORES | HTTP | PENDING | NOT TESTED |
| API-055 | GET | /api/warehouses | WarehousesController | JWT | - | HTTP | PENDING | NOT TESTED |
| API-056 | GET | /api/warehouses/:id | WarehousesController | JWT | - | HTTP | PENDING | NOT TESTED |
| API-057 | POST | /api/warehouses | WarehousesController | JWT | UserADMIN, UserSTORES | HTTP | PENDING | NOT TESTED |
| API-058 | PATCH | /api/warehouses/:id | WarehousesController | JWT | UserADMIN, UserSTORES | HTTP | PENDING | NOT TESTED |
| API-059 | DELETE | /api/warehouses/:id | WarehousesController | JWT | UserADMIN, UserSTORES | HTTP | PENDING | NOT TESTED |
| API-060 | POST | /api/material-issues | MaterialIssueController | JWT | UserSTORES, UserADMIN | HTTP | PENDING | NOT TESTED |
| API-061 | GET | /api/material-issues | MaterialIssueController | JWT | - | HTTP | PENDING | NOT TESTED |
| API-062 | GET | /api/material-issues/:id | MaterialIssueController | JWT | - | HTTP | PENDING | NOT TESTED |
| API-063 | GET | /api/material-movement/status | MaterialMovementController | JWT | - | HTTP | PENDING | NOT TESTED |
| API-064 | GET | /api/notifications/status | NotificationsController | JWT | - | HTTP | PENDING | NOT TESTED |
| API-065 | GET | /api/permissions/status | PermissionsController | JWT | - | HTTP | PENDING | NOT TESTED |
| API-066 | GET | /api/po/status | PoController | JWT | - | HTTP | PENDING | NOT TESTED |
| API-067 | POST | /api/production/receipt | ProductionController | JWT | UserPRODUCTION, UserADMIN | HTTP | PENDING | NOT TESTED |
| API-068 | POST | /api/production/consume | ProductionController | JWT | UserPRODUCTION, UserADMIN | HTTP | PENDING | NOT TESTED |
| API-069 | POST | /api/production/return | ProductionController | JWT | UserPRODUCTION, UserADMIN | HTTP | PENDING | NOT TESTED |
| API-070 | POST | /api/production/return/:id/verify | ProductionController | JWT | UserSTORES, UserADMIN | HTTP | PENDING | NOT TESTED |
| API-071 | GET | /api/production/accounting/:scId | ProductionController | JWT | - | HTTP | PENDING | NOT TESTED |
| API-072 | POST | /api/rm | RmController | JWT | UserDESIGNER, UserADMIN | HTTP | PENDING | NOT TESTED |
| API-073 | POST | /api/rm/:id/items | RmController | JWT | UserDESIGNER, UserADMIN | HTTP | PENDING | NOT TESTED |
| API-074 | POST | /api/rm/:id/submit | RmController | JWT | UserDESIGNER, UserADMIN | HTTP | PENDING | NOT TESTED |
| API-075 | GET | /api/rm | RmController | JWT | - | HTTP | PENDING | NOT TESTED |
| API-076 | GET | /api/rm/:id | RmController | JWT | - | HTTP | PENDING | NOT TESTED |
| API-077 | GET | /api/roles/status | RolesController | JWT | - | HTTP | PENDING | NOT TESTED |
| API-078 | POST | /api/sc | ScController | JWT | UserADMIN, UserDESIGNER, UserSTORES | HTTP | PENDING | NOT TESTED |
| API-079 | GET | /api/sc | ScController | JWT | - | HTTP | PENDING | NOT TESTED |
| API-080 | GET | /api/sc/:id | ScController | JWT | - | HTTP | PENDING | NOT TESTED |
| API-081 | POST | /api/sc/:id/complete | ScController | JWT | UserPRODUCTION, UserADMIN | HTTP | PENDING | NOT TESTED |
| API-082 | POST | /api/sc/:id/close | ScController | JWT | UserSTORES, UserPRODUCTION, UserADMIN | HTTP | PENDING | NOT TESTED |
| API-083 | GET | /api/stores/status | StoresController | JWT | - | HTTP | PENDING | NOT TESTED |
| API-084 | POST | /api/users | UsersController | JWT | UserADMIN | HTTP | PENDING | NOT TESTED |
| API-085 | GET | /api/users | UsersController | JWT | - | HTTP | PENDING | NOT TESTED |
| API-086 | GET | /api/users/:id | UsersController | JWT | - | HTTP | PENDING | NOT TESTED |
| API-087 | PUT | /api/users/:id | UsersController | JWT | UserADMIN | HTTP | PENDING | NOT TESTED |
| API-088 | PATCH | /api/users/:id/activate | UsersController | JWT | UserADMIN | HTTP | PENDING | NOT TESTED |
| API-089 | PATCH | /api/users/:id/deactivate | UsersController | JWT | UserADMIN | HTTP | PENDING | NOT TESTED |
