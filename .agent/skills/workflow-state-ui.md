---
name: workflow-state-ui
description: Design workflow state progression clearly and avoid relying on color alone.
---

# Workflow State Visualization

Status design matters more than generic dashboards in RMRIT — this is fundamentally a manufacturing workflow system.

## Consistent State Ladder

```text
DRAFT → SUBMITTED → SENIOR VERIFIED → STORES PENDING → PARTIALLY ISSUED
→ ISSUED → RECEIVED → IN PRODUCTION → ADDITIONAL REQUEST → COMPLETED
```

## Visual Presentation Rules

1. **Show Current Stage as a Progress Trail**:
   ```text
   ● Design ──── ● Verified ──── ● Stores ──── ◉ Production
   ```
2. **Never Rely on Color Alone**:
   Always pair a distinct icon or glyph with the status label:
   - `✓ Available`
   - `⚠ Partially Available`
   - `! Pending`
   - `↻ Additional Request`
   - `✓ Completed`
   - `✕ Rejected`
