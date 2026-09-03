# Database Conceptual Organization & Domain Groups

> **Roadmap Note**: This document serves as the conceptual reference for **Phase 7 (Database Design Phase)**. No database tables, schemas, or migrations are created in Phase 5.

---

## Conceptual Entity Groupings

```text
IDENTITY (Authentication & Access Control)
├── users                  # User credentials, active state, department
├── roles                  # Operational & governance role definitions
└── permissions            # Granular capability authorizations

BUSINESS (Commercial & Workflow Context)
├── customers              # Industrial client master data
├── po                     # Purchase Order commercial grouping reference
├── sc                     # Sales Order Component (Primary completion unit)
└── products               # Component & assembly catalog references

RM (Raw Material Requirement Definitions)
├── rm_lists               # Parent RM specification for an SC
├── rm_items               # Material rows (grade, profile, dimensions)
└── material attributes    # Optional dimensions (Ø, width, thickness, unit weight)

WORKFLOW (Lifecycle Progression & Transitions)
├── verification           # Senior Designer approvals, edits, & rejections
├── material issues        # Stores physical issue records (full / partial / extra)
├── material receipts      # Production receipt acknowledgments
├── additional requests    # Shortage & defect material requests
└── completions            # SC-level production completion sign-offs

MATERIAL CONTROL (Reconciliation & Accounting Ledger)
├── issues                 # Cumulative issued quantities
├── consumption            # Production material consumed
├── returns                # Physical unused material returned to Stores
└── movements              # Immutable append-only movement audit ledger

SYSTEM (Platform Services)
├── notifications          # In-app event alerts & email logs
└── audit logs             # Immutable compliance trace (Who, What, When)
```

---

## Core Relational Principles (For Phase 7)

1. **SC Independence**: All operational entities (`rm_lists`, `material_issues`, `receipts`, `movements`) attach directly to `sc_id`, **not** `po_id`.
2. **Immutable Transactions**: Records in `MATERIAL CONTROL` and `SYSTEM` are append-only.
3. **No Premature Constraints**: Entity foreign keys, indexing strategies, and column constraints will be designed and migrated in Phase 7.
