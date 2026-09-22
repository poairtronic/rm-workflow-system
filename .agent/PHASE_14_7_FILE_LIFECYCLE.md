# Phase 14.7 - File Lifecycle Implementation Document

## 1. File Lifecycle
The minimum safe file lifecycle implemented consists of:
- **UPLOAD**: File is successfully parsed and metadata is saved (`isActive = true`).
- **ACTIVE**: File appears in metadata, can be associated via attachments, and downloaded if authorized.
- **REMOVED / RETIRED**: File is logically soft-deleted (`isActive = false`) and physical storage deletion is attempted. 

## 2. Active / Removed State
Active state is handled via the existing `isActive` boolean column on the `UploadedFile` entity. To support traceability, two new columns `removedAt` (timestamp) and `removedById` (UUID referring to User) were added to the `UploadedFile` schema.

## 3. File vs Attachment
File removal and Attachment detachment are handled separately:
- **Detach**: Sets `isActive = false` on the `Attachment` record (removes the relation between File and Business Record), but the underlying `UploadedFile` stays active.
- **File Remove**: Sets `isActive = false` on the `UploadedFile`. This disables the actual file itself and hides any corresponding attachments.

## 4. File vs Business Record
File lifecycle operations NEVER delete or modify the business record (e.g. SC, PO, RM Request, Production data, etc.). Deletion logic in `FilesService.removeFile` exclusively interacts with the `UploadedFile` entity. Foreign keys to `User` and `UploadedFile` rely on `RESTRICT`, explicitly avoiding `ON DELETE CASCADE`.

## 5. Metadata Retention
Even after physical removal, `UploadedFile` metadata (like `originalName`, `createdById`, `createdAt`, etc.) remains in the database. `isActive` becomes `false`. 

## 6. Storage Cleanup & Database/Storage Failure Consistency
When removing a file:
1. DB metadata is marked inactive (`isActive = false`) and saved with attribution.
2. Physical storage deletion is executed wrapped in a `try/catch`. 
3. If storage deletion fails, the DB remains inactive but the error is securely logged server-side. This ensures the client receives a reliable "File Removed" state, and storage orphans can be reconciled later (safe-failure).

## 7. Removed File Access
Attempting to download or retrieve metadata for a removed file yields a `404 Not Found`.

## 8. Reattachment Rule & Multiple Attachment Behavior
An inactive (`removed`) file cannot be reattached. The `checkFileAccess` and `getFileMetadata` queries explicitly require `isActive: true`.
Multiple attachments are handled safely. If a file associated with multiple attachments is removed, ALL active references filter it out because the `AttachmentService.list` enforces `file: { isActive: true }`.

## 9. Authorization
Authorization from Phase 14.6 remains structurally intact. Only the original uploader or an `ADMIN` can execute the physical deletion of a file. Role-based checks (`checkFileAccess`) guard the delete API path securely.

## 10. Historical Traceability
By augmenting `UploadedFile` with `removedById` and `removedAt` and avoiding `CASCADE DELETE`, comprehensive traceability is retained without bloating the application with complex table history mechanics.

## 11. Protections (RM Baseline, Production, Inventory)
Because file lifecycle does not write to the business domains, zero mutation propagates to RM Baseline, Production Accounting, or Inventory state. The records are conceptually disjoint at the operation layer.

## 12. Future Phase Boundaries
Phase 14.8 will handle transitioning the `StorageProvider` to a live production Supabase instance and database environments to Neon Postgres, utilizing the same safe abstraction layers constructed here.
