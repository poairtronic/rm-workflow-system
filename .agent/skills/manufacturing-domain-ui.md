---
name: manufacturing-domain-ui
description: Use exact manufacturing domain terminology rather than generic SaaS terminology.
---

# Manufacturing-Domain UI Language

The application must speak the shop floor's language, not generic SaaS language. Always use PO, SC, RM Material, Material Grade, Size, Qty, Available, Pending, Issued, Received, Consumed, Returned, Additional Requirement, and Production Completed.

## Terminology Mapping

| Generic SaaS Term | Manufacturing UI Term |
| :--- | :--- |
| Create New Request | **Create RM List** |
| Request Status | **Material Status** |
| Task Completed | **Production Completed** |
| Transaction History | **Material Movement** |
| Items / Products | **Raw Materials (RM)** |
| Item Type | **Material Grade** |
| Item Specs | **Dimensions / Size** |

## Example Shop Floor Table
```text
RM MATERIAL STATUS
Material    Grade   Size      Required  Issued  Pending
Round Bar   EN31    Ø110×35      2         2       0
Round Bar   OHNS    Ø70×18       1         1       0
MS          MS      Ø150×15      1         0       1
```
