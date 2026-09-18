# PHASE 10.1 — USER MANAGEMENT FOUNDATION

## Discovery & Initial Audit
As required, the first step is an inspection of the current state of authentication, users, and roles.

### 1. Git Status
The repository was clean before Phase 10.1. Previous changes relate to Phase 7 and 8 documentation artifacts.

### 2. File and Directory Audit
- **`backend/src/auth/`**: Contains `AuthController`, `AuthService`, `JwtStrategy`, `JwtAuthGuard`, and `RolesGuard`. The JWT strategy maps `payload.sub` to `userId` which aligns with the critical rule to use `req.user.userId`.
- **`backend/src/auth/enums/role.enum.ts`**: Contains the active roles: `ADMIN`, `DESIGNER`, `STORES`, `PRODUCTION`, `SENIOR_MANAGER`, `GENERAL_MANAGER`.
- **`backend/src/users/entities/user.entity.ts`**: The `User` entity has `id` (uuid), `name`, `email`, `passwordHash`, `roleId` (ManyToOne relation with `Role`), `department`, `isActive`, `createdAt`, `updatedAt`.
- **`backend/src/roles/entities/role.entity.ts`**: The `Role` entity has `id` (uuid), `name`, `description`.

### 3. Critical Findings & Constraints
- **Actor Attribution**: `JwtStrategy` exposes `req.user.userId`. Must strictly use this rather than `req.user.sub`.
- **Role Model**: `UserRole` enum is authoritative. No `SUPER_ADMIN` or `MANAGER` roles exist.
- **Authorization**: User management endpoints (Create, Role Assignment, Activation/Deactivation) must be restricted to `ADMIN` users using `@Roles(UserRole.ADMIN)` and `@UseGuards(JwtAuthGuard, RolesGuard)`.
- **Password Security**: Passwords must be hashed via `bcryptjs` (which is what `AuthService` currently uses) before saving to the DB.
- **Deletion**: Users must not be hard deleted. Deactivation is done by setting `isActive = false`.

## Implementation Plan
1. **Users DTOs**: Create `CreateUserDto` and `UpdateUserDto` in `backend/src/users/dto/`.
2. **Users Service**: Implement `createUser`, `findAll`, `findOne`, `updateUser`, `deactivateUser`, `activateUser`. It will hash passwords and check for email uniqueness.
3. **Users Controller**: Expose the REST endpoints, securing them with `JwtAuthGuard` and `RolesGuard(UserRole.ADMIN)`. Ensure passwords are not returned in responses.
4. **Roles / Permissions Modules**: Leave as-is, since they act as lookup entities, but ensure role existence checks when assigning.
