# RMRIT AI Agent Guide

This directory contains instructions, skills, design guidelines, and business rules configured for AI pair programmers and autonomous coding agents (Google Antigravity, GitHub Copilot, Cursor, etc.).

## Directory Layout

```text
.agent/
├── skills/                             # 10 UI/UX shop floor skills
│   ├── human-centered-workflow-ui.md   # Design around employee action
│   ├── information-hierarchy.md        # Prioritize SC, status, and action
│   ├── manufacturing-domain-ui.md      # Manufacturing terminology
│   ├── workflow-state-ui.md            # Clear state transitions & badges
│   ├── realistic-data-design.md        # Authentic industrial test data
│   ├── progressive-disclosure-ui.md    # 3-tier information disclosure
│   ├── audit-trail-ui.md               # Chronological material movement
│   ├── business-form-ux.md             # Sequential, compact RM forms
│   ├── exception-first-ui.md           # Highlight shortages and alerts
│   └── anti-ai-ui.md                   # Restrained, crisp shop UI
│
├── docs/                               # Complete requirement & architecture spec
├── UI_DESIGN_RULES.md                  # Mandatory UI standards
├── WORKFLOW_RULES.md                   # Inviolable manufacturing business logic
├── DESIGN_SYSTEM.md                    # Color tokens, typography, components
├── OVERVIEW.md                         # High-level architecture summary
├── SKILL.md                            # Main development skill
└── README.md                           # This index
```

## How Agents Should Work
1. Consult `WORKFLOW_RULES.md` before altering database models or business endpoints.
2. Check `UI_DESIGN_RULES.md` and relevant skills in `skills/` before generating frontend views.
3. Reference `docs/` for deep domain logic across approvals, stores, and production accounting.
