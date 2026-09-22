# Phase 14.8 — Supabase Storage + Neon Production Integration Architecture

## Overview
Phase 14.8 establishes the production infrastructure architecture for the RMRIT application.

```
                      RMRIT BACKEND (NestJS)
                               │
             ┌─────────────────┴─────────────────┐
             │                                   │
             ▼                                   ▼
      NEON POSTGRESQL                     SUPABASE STORAGE
             │                                   │
             ├── Users                           └── PDFs
             ├── PO                              ├── Excel (.xls, .xlsx)
             ├── SC                              ├── Drawings
             ├── RM Requests                     ├── Images
             ├── Inventory                       └── Other approved files
             ├── Production
             ├── Attachments
             └── File Metadata
```

---

## 1. Storage & Relational Boundaries

- **Supabase Storage**: Stores actual file binary objects only (PDF, Excel, Drawings, Images).
- **Neon PostgreSQL**: Stores all application/relational business data (Users, PO, SC, RM Requests, Inventory, Production Accounting, Attachments) AND file metadata (`UploadedFile` table).

---

## 2. Environment & Provider Switch

The storage provider is selected at application startup in `FilesModule`:

1. **Development (`NODE_ENV=development`)**:
   - Uses `SupabaseStorageProvider` when `STORAGE_PROVIDER=SUPABASE` or `SUPABASE_URL` is set.
   - Falls back to `LocalStorageProvider` for offline development/testing.
2. **Production (`NODE_ENV=production`)**:
   - Mandates `SupabaseStorageProvider`.
   - Fails fast on startup if `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` are missing.

---

## 3. Storage Key Security Model

Server-generated storage keys follow the format:
```
files/<user-id>/<file-id>_<safe-file-name>
```
- Path traversal sequences (`..`, `\`, `/`) are stripped from original filenames.
- Client cannot specify raw storage paths or arbitrary buckets.

---

## 4. Supported File Types & Limits

- **Allowed Formats**: PDF, PNG, JPEG, JPG, XLS, XLSX.
- **Allowed MIME Types**: `application/pdf`, `image/jpeg`, `image/png`, `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
- **Max File Size**: 5 MB (`maxSize: 5 * 1024 * 1024`).
- **Validation**: Enforced via NestJS `ParseFilePipe` with `AllowedFileTypeValidator` and `MaxFileSizeValidator`. Executable script extensions (`.exe`, `.js`, `.py`, `.sh`, `.bat`) are explicitly rejected.

---

## 5. Storage Compensation & Consistency

1. **Upload Compensation**: If binary object upload to Supabase succeeds but metadata insert to Neon fails, the backend invokes `storageProvider.delete(storageKey)` to prevent orphaned storage objects.
2. **Storage Failure**: If Supabase upload fails, no row is created in `uploaded_files` or `attachments`, keeping database state clean.
3. **Soft-Delete Lifecycle**: Deleting a file marks `is_active = false`, records `removed_by_id` and `removed_at` in Neon, and removes the physical object from storage.
