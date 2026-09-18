# PHASE 9.3: AUTHENTICATION & RBAC ARCHITECTURE

## 1. Authentication Flow
Authentication is managed via `passport-jwt`.
- **Login (`/api/auth/login`)**: Takes `email` and `password`. Verifies the user is active, hashes match (`bcrypt`), and issues a JWT.
- **JWT Content (`sub`, `roles`)**: The `JwtStrategy` reads the `Authorization: Bearer <token>` header, decodes the token, and creates a secure `req.user` context.
- **Context Injection**: The framework injects the validated user as `{ userId, email, role, roles, department }` into the `req` object. No client-supplied role parameters are ever trusted.

## 2. Guard Execution Order
1. **`@UseGuards(JwtAuthGuard)`**: Executes first. Ensures the token is valid, not expired, and sets `req.user`. If it fails, an `Http 401 Unauthorized` is thrown.
2. **`@UseGuards(RolesGuard)`**: Executes second. Extracts the acceptable roles from the `@Roles()` decorator and verifies that `req.user.roles` overlaps with the required roles. If it fails, an `Http 403 Forbidden` is thrown.

## 3. Active Roles
Based on the approved business requirements, the following are the active operational roles defined in `UserRole` enum:
- `ADMIN`
- `DESIGNER`
- `STORES`
- `PRODUCTION`
- `SENIOR_MANAGER`
- `GENERAL_MANAGER`

*(Note: `SENIOR_DESIGNER` is inactive in code, maintaining compliance with Phase 7 requirements).*

## 4. Authorization Matrix
| Module / Operation | Required Role(s) | Transaction Actor Attribute | Notes |
| :--- | :--- | :--- | :--- |
| **Auth** |
| Login | `PUBLIC` | N/A | Rate limiting should be applied here. |
| **Inventory** |
| Get Inventory | `ADMIN, STORES, PRODUCTION, DESIGNER, SENIOR_MANAGER, GENERAL_MANAGER` | N/A | Globally visible to authenticated operational staff. |
| Stock In | `STORES, ADMIN` | `createdById` | Stores authority only. |
| Stock Out | `STORES, ADMIN` | `createdById` | Stores authority only. |
| Stock Adjustment | `ADMIN` | `createdById` | Elevated risk, restricted to Admins. |
| **Material Issue** |
| Create Issue | `STORES, ADMIN` | `issuedById` | Production cannot self-issue. |
| **Production** |
| Receive Material | `PRODUCTION, ADMIN` | `receivedById` | Does not mutate store stock. |
| Record Consumption| `PRODUCTION, ADMIN` | `recordedById` | Tracks actual RM usage. |
| Initiate Return | `PRODUCTION, ADMIN` | `returnedById` | Does not mutate store stock. |
| Verify Return | `STORES, ADMIN` | `confirmedById` | **Store Authority**. Restores stock. |
| **RM Spec** |
| Create RM | `DESIGNER, ADMIN` | `createdById` | Designer authority. |
| Revision | `DESIGNER, ADMIN` | `createdById` | Production/Stores cannot alter baselines. |
| **Sales Order Component (SC)** |
| Create SC | `ADMIN, DESIGNER` (Inferred via business setup) | `createdById` |
| Complete SC | `PRODUCTION, ADMIN` | `completedById` |
| Close SC | `STORES, PRODUCTION, ADMIN` | `closedById` |
| **Additional Request (AMR)** |
| Create Request | `PRODUCTION, DESIGNER, ADMIN` | `requestedById` | Requires SC context. |
| **Approve Request** | **BLOCKED - UNRESOLVED AUTHORITY** | N/A | **See Known Gaps** |

## 5. Security Controls & Fixes
- **Actor Nullification Bug Resolved**: Protected routes were previously mapping `req.user.sub` which resulted in `undefined` actor IDs being passed to the Service layer. This has been remediated; routes now pass `req.user.userId`.
- **Privilege Escalation**: Impossible via DTO manipulation due to `whitelist: true`. Roles are derived strictly from the server-signed JWT.
- **Role Spoofing**: `RolesGuard` pulls strictly from the validated `req.user` object, ignoring `req.body.role` or `req.body.userId`.
- **Database Spoofing**: Service methods exclusively use the injected server-side `actorId` for `createdById`, `issuedById`, `confirmedById`, etc.

## 6. Known Gaps & Blockers
> [!CAUTION]
> **AMR Approval Authority (BLOCKED)**
> The business requirements conflict regarding who is authorized to approve Additional Material Requests. Phase 7.5 proposed `SENIOR_MANAGER`, but the core requirements state that `SENIOR_MANAGER` and `GENERAL_MANAGER` are purely read-only/monitoring roles and should not have approval authority.
> Currently, the code has **no implementation** of an `approveRequest` endpoint.
> **Action Required**: A definitive business decision must establish which role has the authority to approve AMRs before the endpoint can be implemented.

## 7. Deferred Decisions
- Full Role provisioning endpoints (`POST /api/users`) and Admin UI mappings are deferred to later phases; currently relying on database seed data for role definitions.
