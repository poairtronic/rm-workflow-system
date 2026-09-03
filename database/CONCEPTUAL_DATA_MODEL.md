# Database Conceptual Organization & Domain Groups

## Conceptual Entity Groupings

```text
IDENTITY (Authentication & Access Control)
├── users                  # User credentials, active state, department
├── roles                  # 6 system roles: Designer, Stores, Production, Senior Mgr, General Mgr, Admin
└── permissions            # Granular capability authorizations

BUSINESS (Commercial & Workflow Context)
├── customers              # Industrial client master data
├── po                     # Purchase Order commercial grouping reference
├── sc                     # Sales Order Component (Primary completion unit)
└── products               # Component & assembly catalog references

RM (Raw Material Requirement Definitions)
├── rm_requests            # Parent RM specification for an SC (direct to Stores)
├── rm_items               # Material rows (grade, profile, dimensions, quantities)
└── rm_item_snapshots      # Immutable revision tracking (original vs revised)

WORKFLOW (Lifecycle Progression & Transitions)
├── material issues        # Stores physical issue records (INITIAL_ISSUE / ADDITIONAL_ISSUE)
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

## Core Relational Principles

1. **SC Independence**: All operational entities (`rm_requests`, `material_issues`, `receipts`, `consumptions`, `returns`) attach directly to `sc_id`.
2. **Immutable Transactions**: Records in `MATERIAL CONTROL` and `SYSTEM` are append-only.
3. **Direct Submission**: Designer submits directly to Stores without intermediate verification gates.
