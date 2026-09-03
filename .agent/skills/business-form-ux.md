---
name: business-form-ux
description: Build focused, sequential material entry flows instead of overwhelming 30-field forms.
---

# Form UX Engineering

The RM Creation and Material Entry forms are among the highest-frequency screens. Never present a giant unorganized form with 20–30 simultaneous input fields.

## Step-by-Step Guided Sequence
1. **Step 1**: PO Number + RM List Type (`○ Single SC` / `● Entire PO`) $\longrightarrow$ `[Continue]`
2. **Step 2 (if Entire PO)**: SC cards summary showing material count $\longrightarrow$ `[+ Add SC]` / `[Edit]`
3. **Step 3**: Add Material dialog/inline row — Grade, Size, Qty required; optional dimensions (Weight/Width/Thickness/Diameter) based on profile $\longrightarrow$ `[Add Material]`

## Compact Added Rows
After adding items, collapse them into clean, editable summary cards or table rows:

```text
EN31 | Ø110×35 | Qty 2 | [Edit] [Delete]
OHNS | Ø70×18  | Qty 1 | [Edit] [Delete]
MS   | Ø150×15 | Qty 1 | [Edit] [Delete]
```
