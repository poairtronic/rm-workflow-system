---
name: information-hierarchy
description: Control visual priority so operational identifiers, workflow status, and actions dominate.
---

# Information Hierarchy

Control what the user notices first, second, third. For RMRIT, the priority order is strictly:

$$\text{SC Number} \longrightarrow \text{Current Status} \longrightarrow \text{Required Action} \longrightarrow \text{Material Status} \longrightarrow \text{Details} \longrightarrow \text{History}$$

...never: big decorative title → stat cards → icons → charts.

## Bad Example

```text
SC-003
[Pending] [PO-100] [ABC Industries] [4 Materials] [Created 02/09/2026]
[View]
```

## Good Operational Example

```text
SC-003                         PENDING STORES ISSUE
PO-100 · ABC Industries · Air Gauge

Material
EN31   Ø110×35   2   AVAILABLE
OHNS   Ø70×18    1   AVAILABLE
MS     Ø150×15   1   PENDING

Next action: Issue the available materials
                    [Issue Materials]
```

## Core Instructions

- SC number, workflow status, and next required action must dominate the screen.
- Secondary metadata stays visually subordinate.
- Never give every field equal visual weight.
