# Database Architecture & Migration Strategy

This directory contains database documentation, migration strategies, seed data, and schema definitions for the RMRIT application.

## Database Engine
- **Engine**: PostgreSQL 15+ (Hosted on Neon / Supabase or local instance)
- **ORM / Driver**: TypeORM with `pg` driver

## Directory Structure
```text
database/
├── migrations/        # TypeORM migration files (.ts / .sql)
├── seeds/             # Seed data scripts for development & testing
├── schemas/           # Entity schema references & ER diagrams
└── README.md          # Database guide & migration instructions
```

## Migration Workflow
1. Generate migration:
   ```bash
   npm --prefix backend run migration:generate -- database/migrations/InitSchema
   ```
2. Run migrations:
   ```bash
   npm --prefix backend run migration:run
   ```
3. Revert migration:
   ```bash
   npm --prefix backend run migration:revert
   ```

## Entity Planning (Phase 5)
- Core Entities: `User`, `Customer`, `PurchaseOrder`, `SalesOrderComponent` (SC), `RawMaterialRequirement`, `MaterialIssue`, `ProductionReceipt`, `MaterialConsumption`, `MaterialReturn`, `AdditionalMaterialRequest`, `AuditLog`.
