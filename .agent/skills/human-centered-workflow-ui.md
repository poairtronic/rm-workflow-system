---
name: human-centered-workflow-ui
description: Design around what the employee needs to do next, not around database tables or feature lists.
---

# Human-Centered Workflow Design

Design around what the employee needs to **do next**, not around database tables or feature lists. Before building a screen, ask: _"What is the user trying to accomplish here?"_

## Anti-Pattern (Generic AI-Style)

Equal-weight stat cards (`Total PO` / `Total SC` / `Materials` / `Pending` / `Completed`) plus generic "Recent Activities" and "Analytics" blocks — everything looks equally important, nothing tells the user what to do.

## Good Operational Pattern

A Stores screen that leads with the SC, shows material-by-material availability, and ends in one clear, prominent call to action:

```text
MATERIAL ISSUE
PO-100 / SC-003
Customer: ABC Industries · Product: Air Gauge

Material Status
EN31   Ø110×35   Required 2   ✓ Available
OHNS   Ø70×18    Required 1   ✓ Available
MS     Ø150×15   Required 1   ⚠ Pending

3 materials available · 1 material pending
                    [Issue Available Materials]
```

## Guiding Principles

1. Start with the user's immediate job-to-be-done.
2. Group related items by operational context (e.g. materials for an active SC).
3. Always provide a clear, unambiguous next action button at the conclusion of the workflow stage.
