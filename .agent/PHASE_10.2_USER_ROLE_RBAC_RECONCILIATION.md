# PHASE 10.2 — USER / ROLE / RBAC RECONCILIATION

## 1. Current User Architecture
Users are modeled via the `User` TypeORM entity with standard properties (`id`, `name`, `email`, `passwordHash`, `department`, `isActive`) and a foreign key `roleId` binding it to the `Role` entity.

## 2. Current Role Architecture
Roles are stored in the `Role` table and mirrored in the `UserRole` enum (`ADMIN`, `DESIGNER`, `STORES`, `PRODUCTION`, `SENIOR_MANAGER`, `GENERAL_MANAGER`). The application strictly relies on the enum values via `@Roles()` decorators for route protection.

## 3. User → Role Relationship
A standard `@ManyToOne` relationship exists from `User` to `Role`, explicitly preventing deletion of roles assigned to users (`onDelete: 'RESTRICT'`). Users have a single role. 

## 4. Permission Architecture
Role-Based Access Control (RBAC) relies entirely on `RolesGuard`, assessing the user's role extracted from the authenticated JWT token context (`req.user.role`). No distinct standalone permissions table/engine is active, preserving system simplicity while enforcing business rules strictly at the role level.

## 5. Active Roles
`ADMIN`, `DESIGNER`, `STORES`, `PRODUCTION`, `SENIOR_MANAGER`, `GENERAL_MANAGER`.

## 6. Inactive/Legacy Roles
`SENIOR_DESIGNER` is inactive. It does not exist in `role.enum.ts`, no controllers reference it, and it cannot be assigned.

## 7. Role Responsibilities
The roles are constrained correctly. `ADMIN` operates the `users` endpoints, `DESIGNER` operates `rm`, `PRODUCTION` handles manufacturing operations, and `STORES` operates inventory and material issues. 

## 8. User Lifecycle
Users are created active (`isActive = true`). Users are never deleted; instead, they are deactivated via `PATCH /api/users/:id/deactivate`. 

## 9. Role Assignment
Users receive roles via the `UsersController` during creation or update. The controller leverages `@Roles(UserRole.ADMIN)` forcing strict admin authorization. Invalid roles are rejected by both `class-validator` and database `role` lookups.

## 10. Activation/Deactivation
Inactive users are blocked at authentication. `AuthService.validateUserCredentials` throws `UnauthorizedException` if `!user.isActive`.

## 11. JWT Integration
Token signs the exact DB values. `req.user` exposes `userId`, `email`, `role`, and `roles`. No tampering possible due to JWT signature.

## 12. Actor Attribution
`req.user.userId` is properly captured from the strategy payload. No legacy `req.user.sub` logic exists in any controller.

## 13. Authorization Matrix
| Endpoint | Method | Allowed Roles |
|---|---|---|
| User Management | POST/PUT/PATCH | `ADMIN` |
| Master Data | POST/PUT/PATCH | `ADMIN`, `STORES` |
| RM Requests | POST/PATCH | `DESIGNER`, `ADMIN` |
| Stores Issue | POST | `STORES`, `ADMIN` |
| Production Rec | POST | `PRODUCTION`, `ADMIN` |
| Inventory View | GET | `STORES`, `ADMIN`, `SENIOR_MANAGER`, `GENERAL_MANAGER`, `DESIGNER` |

## 14. Security Findings
- The application securely blocks non-admins from promoting themselves or assigning roles.
- Deactivated users are locked out seamlessly.
- Management Roles (`SENIOR_MANAGER`, `GENERAL_MANAGER`) are properly restricted from mutative actions like `stockAdjustment` or `createIssue`.

## 15. Fixes
Implemented strict testing for RBAC rules across `roles.guard.ts` via `roles.guard.spec.ts` securing RBAC-001 through RBAC-020 constraints against regressions.

## 16. Test Matrix
`roles.guard.spec.ts` covers explicit test assertions for DESIGNER, STORES, PRODUCTION, SENIOR_MANAGER, GENERAL_MANAGER restrictions, ADMIN assignment behaviors, and token tampering rejections.

## 17. Database Impact
NO DATABASE SCHEMA CHANGE REQUIRED FOR PHASE 10.2.

## 18. Known Gaps
No functional gaps in existing capabilities.

## 19. AMR Authority Conflict
AMR APPROVAL AUTHORITY REMAINS UNRESOLVED. NO AMR APPROVAL AUTHORITY WAS INVENTED OR IMPLEMENTED. The API endpoints for AMR approval do not exist and were purposefully excluded per instructions.

## 20. Phase 10.3 Readiness
Phase 10.3 (InventoryItem reconciliation, mapping, Opening Balance Migration) is ready.
