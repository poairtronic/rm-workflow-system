# RMRIT Project Documentation Hub

This documentation hub provides requirements, architectural diagrams, domain workflows, UI/UX design rules, and deployment instructions for AI pair programmers and human engineers.

---

## Documentation Directory Map

```text
docs/
│
├── requirements/
│   ├── requirements.md         # Scope, functional requirements & domain boundaries
│   ├── user-stories.md         # Persona user stories (Design, Senior, Stores, Production)
│   ├── business-rules.md       # Inviolable workflow & accounting rules
│   └── roles-permissions.md    # RBAC matrix across all 6 personas
│
├── architecture/
│   ├── system-architecture.md  # Client, server, database, and protocol topology
│   ├── api-architecture.md     # Route conventions, response & error envelopes
│   └── deployment-architecture.md # Render & Neon free-tier infrastructure
│
├── workflow/
│   ├── overall-workflow.md     # High-level state ladder & sequence
│   ├── design-workflow.md      # RM list entry & Senior approval flow
│   ├── stores-workflow.md      # Material availability & issuance
│   ├── production-workflow.md  # Receipt, consumption, returns & completion
│   └── material-lifecycle.md   # Authoritative accounting formulas
│
├── database/
│   └── database-design.md      # Target entity schema for Phase 7
│
├── ui-ux/
│   ├── design-system.md        # Color tokens, typography & components
│   └── ui-rules.md             # 10 UI/UX skills & the Real Employee Test
│
└── development/
    ├── development-guide.md    # Local setup, scripts & environment configuration
    ├── testing-guide.md        # Vitest suites & quality checklist
    └── deployment-guide.md     # Step-by-step Render deployment walkthrough
```
