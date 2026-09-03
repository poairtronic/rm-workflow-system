---
name: audit-trail-ui
description: Render chronological, immutable material movement event trails clearly.
---

# Transaction & Audit Timeline Design

Every physical raw material movement must be traceable. Never collapse a complex lifecycle down to a single static badge without historical trace.

## Chronological Audit Trail Format

```text
SC-003 — MATERIAL HISTORY
09:10  DESIGN SUBMITTED · Raghav · RM list submitted
  ↓
10:05  SENIOR VERIFIED · Senior Manager · No changes
  ↓
11:20  MATERIAL ISSUED · Stores · EN31 20kg, OHNS 10kg
  ↓
12:00  MATERIAL RECEIVED · Production · 30 kg received
  ↓
16:45  MATERIAL RETURNED · Production · 8 kg returned
  ↓
17:00  PRODUCTION COMPLETED · Production · Completed with remarks
```

## Immutable Audit Rules

- An event log answers _"What happened to the material?"_ instantly.
- Show **Who** (user role/name), **What** (action & quantity), and **When** (timestamp).
- Never overwrite past logs; display subsequent corrections as append-only reconciliation entries.
