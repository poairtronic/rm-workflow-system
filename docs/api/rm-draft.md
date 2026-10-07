# RM Draft API

This document details the REST endpoints for managing Raw Material (RM) requests using the "Draft per SC, grouped by PO" pattern.

## Overview
- RMs are 1:1 with Sales Order Components (SCs).
- The Designer groups multiple SCs under a single Purchase Order (PO) in the UI.
- The API supports creating, updating, and submitting these grouped drafts in atomic transactions.

## Endpoints

### 1. Create Draft RMs
**`POST /api/rm/draft`**
Creates a PO (if missing), creates SCs, and creates a `DRAFT` RmRequest with `RmItem`s for each SC.

**Request Body:**
```json
{
  "poNumber": "PO-123",
  "customerId": "uuid-optional",
  "scs": [
    {
      "scNumber": "SC-123-1",
      "productName": "Widget A",
      "items": [
        {
          "productId": "uuid",
          "spec": "EN31",
          "quantity": 10.5
        }
      ]
    }
  ]
}
```

### 2. Get Draft RMs by PO
**`GET /api/rm/po/:poId/draft`**
Returns all `DRAFT` RmRequests for a specific PO created by the caller (or all if ADMIN).

**Response:**
```json
{
  "poId": "uuid",
  "poNumber": "PO-123",
  "scs": [
    {
      "scId": "uuid",
      "scNumber": "SC-123-1",
      "productName": "Widget A",
      "items": [
        {
          "id": "uuid",
          "productId": "uuid",
          "spec": "EN31",
          "quantity": 10.5,
          "material": "Product Name"
        }
      ]
    }
  ]
}
```

### 3. Update Draft RMs by PO
**`PUT /api/rm/po/:poId/draft`**
Replaces the DRAFT RM items for the given PO.
- Drops drafts that are removed from the payload.
- Updates existing drafts.
- Adds new drafts.
- Must not touch non-DRAFT RMs.

**Request Body:**
Same as `POST /api/rm/draft`.

### 4. Submit Draft RMs
**`POST /api/rm/po/:poId/submit`**
Submits all `DRAFT` RmRequests for the PO.
- Updates status to `SUBMITTED`.
- Creates `RmItemSnapshot` for traceability.
- Fires `RM_SUBMITTED` notification to STORES.

**Response:**
```json
{
  "submittedScs": ["SC-123-1"]
}
```

### 5. Get My RMs (Grouped)
**`GET /api/rm/mine`**
Returns RM Requests created by the caller, grouped by PO.

**Response:**
```json
[
  {
    "poId": "uuid",
    "poNumber": "PO-123",
    "draftCount": 1,
    "submittedCount": 0,
    "scs": [
      {
        "scId": "uuid",
        "scNumber": "SC-123-1",
        "productName": "Widget A",
        "status": "DRAFT",
        "itemCount": 1
      }
    ],
    "updatedAt": "2026-10-07T10:00:00Z"
  }
]
```

## Database Mapping (RM Drafts)
- **Product** -> `sales_order_components.product_name`
- **RM Product Selection** -> `rm_items.mapped_product_id` (Product ID) & `rm_items.material` (Product Name)
- **Spec** -> `rm_items.grade`
- **Quantity** -> `rm_items.quantity`

## Visibility Rules
- **DRAFT**: Visible only to the creator (DESIGNER) and ADMIN.
- **SUBMITTED+**: Visible to STORES, PRODUCTION, and MANAGERS.
