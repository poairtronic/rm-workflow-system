---
name: progressive-disclosure-ui
description: Avoid overwhelming shop-floor users by disclosing details progressively in three deliberate levels.
---

# Progressive Disclosure

Never dump every material movement transaction and detail at once on initial load. Structure information across 3 intentional tiers:

## Tier 1: Operational Summary (Default View)
```text
SC-003
Production Status: IN PRODUCTION
Materials: 4 / 4 received
Consumed: 320 kg · Returned: 80 kg · Additional Request: 1
```

## Tier 2: Movement Breakdown (`[View Material Movement]`)
```text
INITIAL ISSUE       — Issued: 500 kg
PRODUCTION          — Consumed: 400 kg · Returned: 100 kg
ADDITIONAL REQUEST  — Requested: 50 kg · Issued: 50 kg
```

## Tier 3: Transaction Audit Details (`[View Transaction Log]`)
Complete timestamped, user-attributed event log with batch numbers, remarks, and receipt confirmations.
