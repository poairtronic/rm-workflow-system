# PHASE 14.6 - FILE AUTHORIZATION

## Architecture Overview

Phase 14.6 implements a centralized, business-record-first file authorization layer for the generic file upload system. It eliminates indirect object reference vulnerabilities (IDOR) on generic file endpoints (`/api/files/:id` and `/api/files/:id/download`) by dynamically enforcing the application's Role-Based Access Control (RBAC) model against the active contexts to which a file is attached.

### The Authorization Chain
`USER -> JWT -> CURRENT USER / ROLE -> BUSINESS RECORD ACCESS CHECK -> ATTACHMENT -> UPLOADED FILE`

### Key Components

1. **Centralized File Authorization Service**
   The core file authorization logic was integrated directly into `AttachmentsService.checkFileAccess`. 
   When a user requests a generic file operation via `FilesController`:
   - `FilesController` intercepts the operation and delegates authorization validation to `AttachmentsService`.
   - The service fetches all active `Attachment` entities linked to the `fileId`.
   
2. **Unattached File Policy**
   Files without any active attachments are treated as private staging artifacts. Access is strictly limited to:
   - The user who originally uploaded the file (`file.createdById === user.userId`)
   - Users with the `ADMIN` role.

3. **Contextual Access Policy**
   Files with active attachments are accessible if the requesting user holds the required role to access **at least one** of the attached business records.
   - The service delegates existence checks (`scService.findOne`, `poService.findOne`, etc.) ensuring the business record hasn't been deleted or invalidated.
   - It iterates through the established `AttachmentContext` instances (PO, SC, PRODUCTION, RM_REQUEST, AMR).
   - If the user satisfies the RBAC rules for any attached business record, access is implicitly granted without creating redundant custom roles or file-specific permissions.

4. **File Removal Security**
   - **Detach vs Delete**: Users with specific roles (e.g., `DESIGNER`, `PRODUCTION`, `STORES`) may have authority to **detach** a file from a business record. However, physically **deleting** a file via the generic `DELETE /api/files/:id` endpoint is a highly destructive operation.
   - Therefore, the physical removal operation is securely restricted *exclusively* to the file's creator or an `ADMIN`, regardless of business record access.

### Compliance with Constraints
- No new file-specific roles were created. The existing six roles remain the singular authority.
- No parallel permission system was introduced. The implementation perfectly bridges generic file IDs into the standard contextual validation chain.

## Test Model
A strict security matrix (`file-authorization-phase14-6.spec.ts`) was authored to guarantee immunity against Actor Spoofing, Invalid Context Access, and Bypassing. See `PHASE_14_6_FILE_AUTHORIZATION_REPORT.md` for certification outcomes.
