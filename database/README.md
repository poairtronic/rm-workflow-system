# Database Architecture & Migration Management

This directory manages TypeORM migrations, seed data, and schema utility scripts for the RMRIT PostgreSQL database.

> **Roadmap Notice**: Full domain schema and table creation is scheduled for the dedicated Database Design phase. Phase 5 establishes the structural directory layout and tooling workflows.

---

## Directory Structure

```text
database/
├── migrations/        # TypeORM migration classes (.ts)
├── seeds/             # Seed data scripts for development & staging
├── scripts/           # Migration runners & diagnostic utilities
└── README.md          # Database guide & TypeORM CLI instructions
```

---

## Migration Commands (TypeORM CLI)

When creating or running migrations in later phases, use the following workspace scripts from project root:

### 1. Generate Migration from Entities

```bash
npm --prefix backend run migration:generate -- database/migrations/<MigrationName>
```

### 2. Create Blank Migration

```bash
npm --prefix backend run migration:create -- database/migrations/<MigrationName>
```

### 3. Run Pending Migrations

```bash
npm --prefix backend run migration:run
```

### 4. Revert Last Migration

```bash
npm --prefix backend run migration:revert
```

---

## Planned Entities for Database Design Phase

- `User` & `Role` (Authentication & Security)
- `Customer` (Client Master Data)
- `PurchaseOrder` (External Commercial Reference)
- `SalesOrderComponent` (SC - Primary Workflow Unit)
- `RawMaterialRequirement` (Immutable RM List)
- `MaterialIssue` (Stores Issuance Ledger)
- `ProductionReceipt` (Production Acknowledgment)
- `MaterialMovement` (Append-Only Accounting Ledger)
- `AdditionalMaterialRequest` (Shortage & Extra Requests)
- `Notification` (Event Alerts)
- `AuditLog` (Immutable Compliance History)
