# RMRIT — INVENTORY MODULE CONCEPT

## Document Purpose

This document defines the permanent conceptual and architectural understanding of the Inventory Module in the RMRIT application.

This is a SOURCE-OF-TRUTH document for all Inventory-related development.

Any AI coding agent, developer, or implementation process working on Inventory MUST read and understand this document before modifying Inventory-related code.

The Inventory Module is a CORE BUSINESS MODULE of RMRIT.

It must be designed carefully because future Raw Material workflow, Stores operations, Production material tracking, returns, additional material requests, material transformations, alerts, and analytics will depend on this module.

---

# 1. APPLICATION CONTEXT

RMRIT is an internal manufacturing application designed to digitize the company's raw material and production material workflow.

The application contains several business domains:

- Authentication
- Users and Roles
- Purchase Orders
- SC / Production Units
- Raw Material
- Inventory
- Stores
- Production
- Material Movement
- Additional Material Requests
- Notifications
- Analytics
- Audit

Among these domains, INVENTORY is a foundational and central domain.

Inventory must therefore be implemented as a reliable, traceable, database-backed business system.

---

# 2. CORE INVENTORY PRINCIPLE

Inventory represents the company's current material stock.

The system must always be able to answer:

1. What material do we have?
2. How much do we have?
3. What unit is the quantity measured in?
4. Is the stock below its minimum level?
5. How did the current stock quantity change?
6. Who changed the stock?
7. When did the change happen?
8. Why did the change happen?
9. What business transaction caused the change?
10. Can the current stock balance be trusted?

Inventory must therefore NOT be implemented as a simple table containing only:

    material
    quantity

Inventory must be based on:

    Inventory Master
          ↓
    Stock Balance
          ↓
    Stock Transaction Ledger
          ↓
    Audit / Traceability

---

# 3. INVENTORY ARCHITECTURE

The fundamental Inventory architecture is:

    InventoryItem
          │
          ├──────────────→ StockBalance
          │
          └──────────────→ StockTransaction

Conceptually:

    INVENTORY ITEM
          │
          ↓
    CURRENT STOCK BALANCE
          │
          ↓
    STOCK MOVEMENT
          │
          ↓
    TRANSACTION LEDGER

InventoryItem identifies WHAT is being stocked.

StockBalance represents HOW MUCH is currently available.

StockTransaction records WHY and HOW the quantity changed.

These concepts must not be incorrectly merged.

---

# 4. INVENTORY ITEM

An InventoryItem represents a distinct material/product identity that can exist in inventory.

Examples:

    OHNS 31 Dia
    OHNS 43 Dia
    OHNS 45 Dia
    Long Bar 45 Dia
    Long Bar 55 Dia

These are different inventory items unless the business explicitly defines otherwise.

The system must never accidentally merge different materials because their names look similar.

---

# 5. INVENTORY ITEM IDENTITY

Inventory identity is critical.

An InventoryItem may conceptually contain:

    id
    material
    materialType
    grade
    size
    unit
    minimumStockLevel
    isActive
    createdAt
    updatedAt

The exact implementation may use different field names if the existing architecture follows different conventions.

The business meaning must remain equivalent.

Inventory identity must be uniquely enforceable.

For example:

    OHNS
    31 Dia

must not accidentally become the same item as:

    OHNS
    43 Dia

Likewise:

    OHNS 45 Dia

must not automatically become:

    Long Bar 45 Dia

The application must distinguish materials based on their actual business identity.

---

# 6. MATERIAL FAMILIES

The company has approximately 20–25 material/product families.

Examples include:

    OHNS
    Long Bar
    etc.

However, the complete material catalogue has NOT yet been defined in this document.

Therefore:

DO NOT invent the company's complete material catalogue.

DO NOT hard-code assumptions about all material families.

DO NOT invent material conversion rules.

Material master data may be expanded later when the actual business information is provided.

---

# 7. SIZE

Inventory must support material size information.

Examples:

    31 Dia
    43 Dia
    45 Dia
    55 Dia

The application must preserve the actual size information supplied by the business.

Do not silently normalize or reinterpret sizes into a different manufacturing meaning.

Examples such as:

    45 Dia
    DIA 45
    Ø45

must not automatically be treated as different or identical unless the business/data model defines the normalization rule.

---

# 8. UNIT

Every stock quantity must have a clearly defined unit.

Possible units may include:

    KG
    PCS
    MM
    M
    SET

This is an example only.

The final supported unit catalogue must come from the actual business requirements.

DO NOT invent unit conversions.

For example:

    KG → PCS

must not be automatically converted unless an explicit business conversion rule exists.

Likewise:

    MM → M

should not be silently converted unless the application explicitly supports it.

---

# 9. UNIT CONSISTENCY

The unit of an InventoryItem is the base unit for its stock.

Conceptually:

    InventoryItem
        ↓
    Unit
        ↓
    StockBalance
        ↓
    StockTransaction

Example:

    OHNS 31 Dia
    Unit = KG

Then its stock should be represented as:

    100 KG

not:

    100
    unknown unit

Stock transactions must not silently use incompatible units.

---

# 10. STOCK BALANCE

StockBalance represents the current available quantity of an InventoryItem.

Conceptually:

    InventoryItem
         ↓
    StockBalance
         ↓
    currentQuantity

Example:

    Inventory Item:
    OHNS 31 Dia

    Current Stock:
    100 KG

The current stock balance must be database-backed.

It must not depend solely on frontend calculations.

---

# 11. CURRENT BALANCE IS IMPORTANT

The application will frequently need the current stock immediately.

Therefore the architecture may maintain a StockBalance record rather than recalculating the entire historical ledger every time inventory is displayed.

Conceptually:

    StockTransaction Ledger
            ↓
    StockBalance

The StockBalance provides efficient current-state access.

The transaction ledger provides historical traceability.

Both must remain consistent.

---

# 12. STOCK TRANSACTION

StockTransaction represents a stock-changing event.

Examples:

    STOCK_IN
    STOCK_OUT
    ADJUSTMENT

Future phases may introduce additional business transaction types.

Examples:

    ISSUE
    RETURN
    CONSUMPTION
    TRANSFORMATION_IN
    TRANSFORMATION_OUT

These future types must NOT be implemented merely because they are mentioned here.

They are documented here only to show future architectural extensibility.

---

# 13. STOCK TRANSACTION PURPOSE

Every stock-changing event must be recorded.

For example:

    Current Stock = 100 KG

    Stock In = +50 KG

must result conceptually in:

    StockTransaction
        Type = STOCK_IN
        Quantity = 50 KG
        User = Stores User
        Timestamp = ...
        Remarks = ...
        
    StockBalance
        Current = 150 KG

The balance must not be changed silently.

---

# 14. INVENTORY LEDGER

The transaction ledger is the historical record of stock movement.

Example:

    DATE       TYPE          QTY       RESULT
    ------------------------------------------------
    08-Sep     OPENING       +250       250
    09-Sep     STOCK_IN      +100       350
    10-Sep     STOCK_OUT      -50       300
    11-Sep     ADJUSTMENT      -5       295

The exact implementation may differ.

The important business principle is:

Every stock change must have an identifiable historical record.

---

# 15. LEDGER IMMUTABILITY

Historical StockTransactions should be treated as immutable business records.

Normal users must not be able to:

    edit historical quantity
    change transaction type
    change transaction user
    delete historical transactions

If a previous transaction was incorrect, the preferred correction mechanism is a new compensating transaction or adjustment.

Example:

Incorrect:

    +100 KG

Correct:

    +90 KG

Do NOT rewrite history from:

    +100

to:

    +90

Instead record:

    +100
    -10 adjustment

This preserves traceability.

---

# 16. STOCK BALANCE CALCULATION

Conceptually:

    Current Balance
    =
    Opening Stock
    + Stock In
    - Stock Out
    ± Adjustments
    ± Future Valid Stock Movements

The exact transaction types used by the implementation may differ.

The important rule is:

The current balance must have a traceable relationship with the ledger.

---

# 17. STOCK MOVEMENT

A Stock Movement changes the quantity of an InventoryItem.

The foundational movement types are:

    STOCK_IN
    STOCK_OUT
    ADJUSTMENT

Each movement must:

1. Validate the InventoryItem.
2. Validate quantity.
3. Validate unit.
4. Determine the movement type.
5. Record the transaction.
6. Update the stock balance.
7. Record the responsible user.
8. Record timestamp.
9. Record remarks/reference when applicable.
10. Commit atomically.

---

# 18. STOCK IN

Stock In increases available inventory.

Example:

    Current = 100 KG

    STOCK_IN = +50 KG

    New Current = 150 KG

The stock transaction must be recorded.

The balance must be updated atomically with the transaction.

---

# 19. STOCK OUT

Stock Out decreases available inventory.

Example:

    Current = 100 KG

    STOCK_OUT = -30 KG

    New Current = 70 KG

The backend must validate that sufficient stock exists.

Example:

    Available = 100 KG
    Requested = 30 KG

    Allowed

But:

    Available = 100 KG
    Requested = 120 KG

must be rejected.

The system must not create a negative stock balance.

---

# 20. STOCK OUT IS NOT THE SAME AS PRODUCTION ISSUE

This distinction is extremely important.

Generic inventory STOCK_OUT is a foundational inventory operation.

Future:

    Stores
       ↓
    Production
       ↓
    Material Issue

is a separate business workflow.

Do NOT assume that every STOCK_OUT is a Production issue.

Future Production material issue will require references to:

    RM
    PO
    SC
    Issue
    Production

Those workflows belong to later phases.

---

# 21. STOCK ADJUSTMENT

Adjustment is used to correct inventory based on legitimate business reasons.

Example:

    System Stock = 100 KG
    Physical Stock = 97 KG

Adjustment:

    -3 KG

Result:

    97 KG

The adjustment must create a transaction.

Do not silently overwrite:

    100 → 97

without recording why.

---

# 22. ADJUSTMENT REASON

Adjustments must have an identifiable reason.

Possible examples:

    Physical stock correction
    Counting error
    Damaged material
    Data correction
    Opening balance correction
    Other

These are examples only.

Do not create elaborate approval workflows unless explicitly required.

---

# 23. OPENING STOCK

Inventory may require initial stock when the system is first populated.

Opening stock must be traceable.

Example:

    OHNS 31 Dia
    Opening Stock = 250 KG

This should conceptually appear in the ledger as an opening balance transaction or an explicitly equivalent transaction.

Do not silently populate current quantity without traceability.

---

# 24. ATOMICITY

Stock transaction creation and balance update must be atomic.

Conceptually:

    BEGIN TRANSACTION

        Create StockTransaction

        Update StockBalance

    COMMIT

If either operation fails:

    ROLLBACK

The system must never create:

    transaction without balance update

or:

    balance update without transaction

This is a core inventory integrity requirement.

---

# 25. CONCURRENCY

Inventory may be modified by multiple Stores/Admin users.

The system must prevent lost-update problems.

Example:

    Initial = 100

    User A → +10
    User B → +20

Expected:

    130

The architecture must not accidentally produce:

    110

or:

    120

because one update overwrote another.

Database-level atomic operations, transactions, row locking, or an equivalent reliable strategy may be used.

Do not claim concurrency safety without verifying the actual implementation.

---

# 26. NEGATIVE STOCK

Negative stock is not allowed for normal stock availability.

Example:

    Current = 10 KG
    Stock Out = 15 KG

must be rejected.

The database should provide appropriate protection where possible.

Backend validation remains mandatory.

Frontend validation is not sufficient.

---

# 27. SERVER IS THE AUTHORITY

The backend is the authoritative source for inventory.

The frontend must NEVER be trusted to determine:

    final stock balance
    transaction quantity
    transaction user
    transaction timestamp
    authorization
    stock availability

The backend must calculate and validate these values.

The frontend is responsible for user interaction and presentation.

---

# 28. MINIMUM STOCK LEVEL

Each applicable InventoryItem may have a minimum stock level.

Example:

    OHNS 31 Dia
    Minimum = 20 KG

If:

    Current = 21 KG

status:

    NORMAL

If:

    Current = 20 KG

status:

    NORMAL

If:

    Current = 19 KG

status:

    LOW_STOCK

The business rule is:

    currentQuantity < minimumStockLevel
        → LOW_STOCK

    currentQuantity >= minimumStockLevel
        → NORMAL

---

# 29. LOW STOCK VS LOW STOCK NOTIFICATION

These are different concepts.

LOW_STOCK is an inventory state.

LOW_STOCK_NOTIFICATION is a future notification feature.

Phase 10 may establish reliable LOW_STOCK calculation.

It must NOT automatically implement:

    email
    WebSocket
    push notification
    management alerts

unless explicitly instructed by a later phase.

---

# 30. INVENTORY USERS

The final RMRIT roles are:

    DESIGNER
    STORES
    PRODUCTION
    SENIOR_MANAGER
    GENERAL_MANAGER
    ADMIN

There is NO:

    SENIOR_DESIGNER

Do not reintroduce Senior Designer.

---

# 31. INVENTORY ROLE PRINCIPLES

Conceptually:

    ADMIN
        Full inventory access

    STORES
        Inventory operational management

    DESIGNER
        Inventory visibility

    PRODUCTION
        Limited inventory visibility as required by later workflows

    SENIOR_MANAGER
        Read-only monitoring

    GENERAL_MANAGER
        Read-only monitoring

The exact endpoint permissions must be implemented using the application's existing RBAC architecture.

---

# 32. RBAC SECURITY

Do not rely on frontend hiding buttons.

Backend endpoints must enforce authorization.

A user who cannot manage inventory must not be able to call the mutation API directly.

Existing:

    JwtAuthGuard
    RolesGuard
    @Roles()

must be reused.

Do not rebuild the authorization system.

---

# 33. INVENTORY AUDITABILITY

A stock movement should answer:

    WHO
    WHAT
    WHEN
    HOW MUCH
    WHY
    REFERENCE

Example:

    User:
    Stores User

    Material:
    OHNS 31 Dia

    Operation:
    STOCK_OUT

    Quantity:
    25 KG

    Time:
    10-Sep-2026 14:31

    Remarks:
    Physical issue

The exact fields may differ, but the information must remain traceable.

---

# 34. INVENTORY VS AUDIT MODULE

StockTransaction is the inventory movement ledger.

The application's general Audit module may separately record application-level actions.

These are related but not necessarily identical.

Do not assume that:

    Audit Log

automatically replaces:

    Stock Transaction Ledger

The inventory ledger must remain capable of explaining stock movement.

---

# 35. INVENTORY SEARCH

Inventory users should be able to find materials quickly.

Search may use:

    Material
    Material Type
    Grade
    Size

The exact searchable fields must match the actual inventory data model.

Do not implement meaningless search fields.

---

# 36. INVENTORY FILTERING

Useful filters may include:

    All
    Normal
    Low Stock
    Inactive

Additional filters may be added only when justified by the actual business requirement.

---

# 37. INVENTORY DETAIL

An InventoryItem detail view should eventually provide:

    Material
    Material Type
    Grade
    Size
    Unit
    Minimum Stock
    Current Stock
    Stock Status

and historical:

    Transaction History

---

# 38. TRANSACTION HISTORY

Transaction history should make it easy to understand stock movement.

Conceptually:

    Date
    Transaction Type
    Quantity
    Balance
    User
    Reference
    Remarks

The exact columns depend on the actual implementation.

Large histories should support pagination.

Do not load unlimited transaction history into the browser.

---

# 39. STOCK RECONCILIATION

The system should be capable of detecting inconsistencies between:

    StockBalance

and:

    StockTransaction Ledger

Conceptually:

    Ledger-derived Balance
            ≠
    Stored StockBalance

means:

    INVENTORY INCONSISTENCY

The system must not silently hide such inconsistencies.

Do not silently repair them without an explicit controlled mechanism.

---

# 40. INVENTORY HEALTH

The inventory architecture should be capable of detecting conditions such as:

    Missing StockBalance
    Duplicate InventoryItem
    Invalid Quantity
    Negative Balance
    Invalid Unit
    Missing Transaction User
    Ledger/Balance mismatch

The exact implementation may be added in the appropriate phase.

---

# 41. DATA INTEGRITY

Inventory must use appropriate:

    Primary Keys
    Foreign Keys
    Unique Constraints
    Check Constraints
    Indexes
    Not-null constraints

Database constraints should protect important business rules.

Application validation alone is not sufficient.

---

# 42. QUANTITY DATA TYPE

Inventory quantities may potentially require decimal values.

Examples:

    10 KG
    10.5 KG
    10.25 KG

The actual database type must support the precision required by the business.

Do not use inappropriate floating-point representations for quantities where exact decimal arithmetic is required.

Do not change precision assumptions without verifying actual business requirements.

---

# 43. PAGINATION

Inventory lists and transaction histories may grow over time.

The architecture should support pagination.

Conceptually:

    page
    limit

or the project's established pagination mechanism.

Do not assume the inventory will always contain only 20–25 records.

The 20–25 figure refers to material/product families, not necessarily the total number of inventory records.

---

# 44. FUTURE RM INTEGRATION

Future phases will connect Raw Material workflow with Inventory.

Conceptually:

    Designer
        ↓
    RM List
        ↓
    Stores
        ↓
    Inventory Availability
        ↓
    Material Issue
        ↓
    Production

Inventory must be designed so this future integration can occur without rewriting the core inventory engine.

Do NOT implement this workflow in the Inventory Foundation/Core phases unless explicitly instructed.

---

# 45. FUTURE PRODUCTION INTEGRATION

Future Production workflow will include:

    Material Received
    Material Consumed
    Material Returned
    Unaccounted Quantity

Example:

    Received = 100 KG
    Consumed = 70 KG
    Returned = 30 KG
    Unaccounted = 0 KG

If:

    Received = 100 KG
    Consumed = 60 KG
    Returned = 20 KG

then:

    Unaccounted = 20 KG

This is a future Production workflow.

Do NOT implement it merely because this document describes it.

---

# 46. FUTURE ADDITIONAL MATERIAL REQUEST

Production will eventually be able to request additional material.

Conceptually:

    Production
        ↓
    Additional Material Request
        ↓
    Stores
        ↓
    Inventory
        ↓
    Additional Issue
        ↓
    Production

The original RM must remain traceable.

Additional requests must not overwrite the original RM.

This is a future workflow.

Do NOT implement it in the Inventory Core phase.

---

# 47. FUTURE MATERIAL TRANSFORMATION

The company may transform one inventory item into another.

Conceptual example:

    Long Bar 45 Dia
          ↓
       Cutting
          ↓
    Cut Piece 45 Dia

This means:

    Parent Inventory
          ↓
       Operation
          ↓
    Child Inventory

However:

THE EXACT MATERIAL TRANSFORMATION RULES HAVE NOT YET BEEN PROVIDED.

Therefore:

DO NOT:

    invent operations
    invent conversion ratios
    invent parent/child relationships
    invent wastage rules
    invent yield rules
    invent material conversions

Only implement transformation when the actual business rules are provided.

---

# 48. FUTURE NOTIFICATIONS

Inventory may eventually generate:

    Low Stock Alert

Other application events may generate:

    RM Submitted
    Material Issued
    Additional Material Requested
    Production Completed

These are future notification requirements.

Inventory Core must not implement the notification engine unless explicitly instructed.

---

# 49. FUTURE ANALYTICS

Future management analytics may use inventory data.

Examples:

    Current Stock
    Low Stock Materials
    Material Movement
    Consumption
    Returns
    Material Usage
    Production Throughput

Analytics must query reliable inventory data.

Do NOT implement management analytics in the Inventory Core phase.

---

# 50. INVENTORY IS NOT RAW MATERIAL

Do not automatically assume:

    Inventory Item = RM List Item

They are related concepts but serve different purposes.

RM represents material requirements for a production unit.

Inventory represents actual material stock available in the company.

Future workflow connects them.

---

# 51. INVENTORY IS NOT PRODUCTION

Inventory must remain independent from Production.

Production will consume/return material through future workflows.

Do not put Production-specific business logic directly into the foundational Inventory model unless required.

---

# 52. INVENTORY IS NOT STORES

Stores is a role/operational department that manages inventory.

Inventory itself is the domain representing stock.

Do not create an architecture where Inventory exists only inside Stores.

Other roles need controlled visibility into inventory.

---

# 53. SINGLE SOURCE OF TRUTH

For current available stock:

    Inventory StockBalance

must be the authoritative operational representation.

For historical stock movement:

    StockTransaction Ledger

must be the authoritative historical record.

The frontend must not become a source of truth.

RM forms must not become a source of truth for current stock.

Production forms must not become a source of truth for current stock.

---

# 54. NO DIRECT FRONTEND BALANCE MANIPULATION

Never design an API that accepts:

    currentQuantity

from the client and blindly writes it into StockBalance.

Incorrect:

    PATCH /inventory/:id
    {
        currentQuantity: 500
    }

Correct conceptual behavior:

    POST stock movement
        ↓
    validate movement
        ↓
    create transaction
        ↓
    calculate/update balance
        ↓
    return resulting state

---

# 55. STOCK BALANCE AND LEDGER CONSISTENCY

Whenever a valid stock movement occurs:

    StockTransaction
          +
    StockBalance

must be updated consistently.

Example:

    Current = 100

    +50

Result:

    Transaction = +50
    Balance = 150

Never:

    Transaction = +50
    Balance = 100

and never:

    Transaction missing
    Balance = 150

---

# 56. ERROR HANDLING

Inventory errors must be explicit and safe.

Examples:

    Inventory item not found
    Duplicate inventory item
    Invalid quantity
    Invalid unit
    Insufficient stock
    Unauthorized inventory operation
    Invalid transaction
    Invalid adjustment

Do not expose raw database errors to normal users.

Use the application's existing exception handling architecture.

---

# 57. NO FAKE INVENTORY

Inventory APIs must never return fake/demo data as production behavior.

Do not use:

    hardcoded arrays
    fake quantities
    fake transactions
    mock balances

except in explicitly isolated unit tests or development seeds.

---

# 58. NO PLACEHOLDER IMPLEMENTATIONS

Do not consider this implementation complete if a controller simply returns:

    { status: "ready" }

or:

    []

without implementing the actual required behavior.

All claimed Inventory functionality must be real.

---

# 59. INVENTORY UI PRINCIPLES

Inventory is an operational business interface.

The UI should prioritize:

    Accuracy
    Readability
    Quantity visibility
    Material identification
    Stock status
    Search
    Filtering
    Traceability
    Clear actions

Avoid unnecessary:

    gradients
    giant hero sections
    decorative cards
    excessive animations
    meaningless KPI cards
    generic SaaS dashboard patterns

The interface should look like a professional manufacturing/internal operations application.

---

# 60. PHASED DEVELOPMENT RULE

Inventory will be implemented progressively.

Each Inventory phase must:

1. Read this document.
2. Inspect the existing repository.
3. Understand what previous phases implemented.
4. Implement ONLY the current phase.
5. Test the current phase.
6. Preserve previous functionality.
7. Avoid future-phase functionality.
8. Stop when the requested phase is complete.
9. Produce a completion report.

Never assume that because a future concept is described here it should be implemented immediately.

---

# 61. PHASE 10 CONCEPTUAL ROADMAP

Phase 10 is the Inventory Core & Stock Movement Engine.

Conceptual progression:

    10.1
    Inventory Domain Review

    ↓

    10.2
    Inventory Master Data

    ↓

    10.3
    Stock Movement Model

    ↓

    10.4
    Stock IN

    ↓

    10.5
    Stock OUT

    ↓

    10.6
    Stock Adjustment

    ↓

    10.7
    Ledger & Balance Reconciliation

    ↓

    10.8
    Inventory Search / Filter / View

    ↓

    10.9
    Transaction History

    ↓

    10.10
    Inventory Audit & Security

    ↓

    10.11
    Inventory Testing

    ↓

    10.12
    Inventory Hardening

Each stage will be implemented separately.

An AI coding agent MUST NOT implement all stages automatically.

The user will provide the specific phase instruction.

---

# 62. PHASE BOUNDARY RULE

If the current instruction is:

    PHASE 10.2

implement ONLY Phase 10.2.

Do NOT implement:

    10.3
    10.4
    10.5
    10.6
    etc.

Likewise, if the instruction is:

    PHASE 10.5

do not implement Phase 11 functionality.

---

# 63. FUTURE FEATURES THAT MUST NOT BE PREDICTED

The AI agent must not proactively implement future functionality simply because it can predict it.

Do NOT implement without explicit instruction:

    Production Issue
    Production Receipt
    Consumption
    Return
    Additional Request
    Material Transformation
    Low Stock Notifications
    Email
    WebSocket
    Analytics
    SC Completion
    SC Closure

Architecture may remain extensible for these features.

Implementation must wait for the appropriate phase.

---

# 64. CHANGE DISCIPLINE

Inventory is a critical domain.

Prefer:

    small changes
    clear migrations
    focused services
    strong validation
    explicit business rules
    tests
    traceability

Avoid:

    large unrelated refactors
    rewriting existing domains
    replacing working architecture
    speculative abstractions
    unnecessary dependencies

---

# 65. EXISTING TECHNOLOGY

The existing application uses:

    Frontend:
    React + Vite + TypeScript

    Backend:
    NestJS + TypeScript

    Database:
    PostgreSQL

    ORM:
    TypeORM

    Authentication:
    JWT

    Authorization:
    JwtAuthGuard + RolesGuard + @Roles()

The Inventory Module must follow the existing project architecture.

Do not introduce a new technology or framework unless explicitly required.

---

# 66. DATABASE PRINCIPLE

Do not recreate the entire database.

Extend the existing schema through migrations.

Preserve existing:

    Users
    Roles
    PO
    SC
    RM
    Production
    Audit

unless a specific requirement requires integration.

Never delete existing business data simply to simplify Inventory implementation.

---

# 67. MIGRATION PRINCIPLE

Inventory schema changes must use proper migrations.

Do not manually modify production database structures outside the project's migration strategy.

Migrations should be:

    deterministic
    reviewable
    safe
    reversible where supported by project standards

---

# 68. TEST PRINCIPLE

Inventory tests must verify business behavior, not only code coverage.

Important test categories include:

    Inventory identity
    Duplicate prevention
    Stock In
    Stock Out
    Adjustment
    Negative stock prevention
    Minimum stock
    Unit validation
    Ledger creation
    Balance updates
    Atomicity
    Concurrency
    RBAC
    Unauthorized access
    Error handling
    Reconciliation

Tests must reflect actual business rules.

---

# 69. SECURITY PRINCIPLE

Inventory is controlled business data.

Never trust:

    frontend role
    frontend quantity
    frontend balance
    frontend user ID
    frontend timestamp

The server must determine:

    authenticated user
    authorization
    transaction timestamp
    stock balance
    transaction result

---

# 70. PERFORMANCE PRINCIPLE

Inventory should remain efficient as the number of materials and transactions increases.

Avoid:

    scanning the entire transaction ledger for every current-stock request
    loading unlimited history
    N+1 queries
    unnecessary API requests
    unnecessary frontend data

Use:

    indexed queries
    current balance
    pagination
    appropriate joins
    efficient database operations

where justified.

---

# 71. DESIGN PRINCIPLE

Inventory should feel like a real manufacturing inventory system, not a generic SaaS dashboard.

The primary visual hierarchy should emphasize:

    Material
    Grade
    Size
    Available Quantity
    Unit
    Minimum Stock
    Status

The user should be able to understand stock availability quickly.

---

# 72. IMPORTANT TERMINOLOGY

Use these terms consistently:

    Inventory Item
    Stock Balance
    Stock Transaction
    Stock Movement
    Stock In
    Stock Out
    Adjustment
    Minimum Stock
    Low Stock
    Ledger

Do not randomly introduce alternative terminology that changes the business meaning.

---

# 73. PO AND SC RELATIONSHIP

PO and SC are important to the overall application.

However, foundational Inventory does not depend on PO completion.

SC is the independent production/closure unit.

Future Inventory-related transactions may reference:

    PO
    SC
    RM
    Issue
    Production

when those workflows are implemented.

Do not make inventory dependent on all SCs under a PO being completed.

---

# 74. SC INDEPENDENCE

Future material workflows must preserve:

    PO-001 / SC-001 → Completed
    PO-001 / SC-002 → In Production
    PO-001 / SC-003 → Pending Material

SCs must operate independently.

The Inventory Module must not introduce a PO-level completion dependency.

---

# 75. SENIOR MANAGER AND GENERAL MANAGER

Senior Manager and General Manager are monitoring/governance roles.

They are NOT inventory approvers.

They should not become mandatory approval gates for stock movement unless a future explicit business requirement says so.

Do not reintroduce Senior Designer-style approval architecture.

---

# 76. ADMIN

Admin has full system access.

However, "full access" does not mean bypassing the ledger.

Even Admin stock changes should remain traceable.

Admin must not silently alter historical inventory balances.

---

# 77. STORES

Stores is the primary operational inventory role.

Stores will eventually:

    Add stock
    View stock
    Issue material
    Verify returns
    Manage inventory

Phase-specific implementation determines which of these capabilities are active.

Do not implement future Stores workflows early.

---

# 78. DESIGNER

Designer will eventually need inventory visibility when preparing RM.

Designer should be able to understand:

    available material
    current stock
    stock status

but must not manage inventory.

Future RM integration will use this visibility.

---

# 79. PRODUCTION

Production will eventually interact with material through:

    receipt
    consumption
    return
    additional requests

These are future workflows.

Do not place Production consumption logic inside the foundational Inventory Module prematurely.

---

# 80. CORE BUSINESS INVARIANTS

The following invariants MUST always be preserved.

### Invariant 1

Inventory quantity must never be changed without a traceable stock transaction.

### Invariant 2

Stock balance must never become negative through a valid stock-out operation.

### Invariant 3

Stock transaction and balance update must be atomic.

### Invariant 4

Historical stock transactions must remain immutable.

### Invariant 5

Frontend cannot be the authority for stock quantity.

### Invariant 6

Backend authorization must protect stock mutation.

### Invariant 7

Inventory item identity must prevent accidental duplicate material records.

### Invariant 8

Units must remain consistent.

### Invariant 9

Minimum stock status must follow:

    current < minimum
    → LOW_STOCK

### Invariant 10

Material transformation rules must never be invented.

### Invariant 11

Future Production/RM workflows must not corrupt the Inventory ledger.

### Invariant 12

PO completion must never be required for an individual SC to close.

---

# 81. AI AGENT BEHAVIOR RULE

When implementing any Inventory phase, the AI agent must follow this decision process:

    READ INVENTORY_MODULE_CONCEPT.md
              ↓
    READ CURRENT PROJECT CODE
              ↓
    READ PREVIOUS PHASE IMPLEMENTATION
              ↓
    IDENTIFY CURRENT PHASE ONLY
              ↓
    IMPLEMENT ONLY CURRENT PHASE
              ↓
    TEST
              ↓
    VERIFY BUSINESS INVARIANTS
              ↓
    REPORT
              ↓
    STOP

Do not skip repository inspection.

Do not assume missing implementation.

Do not invent business rules.

Do not implement future phases.

---

# 82. WHEN REQUIREMENTS ARE UNCLEAR

If a required business rule is not defined:

DO NOT guess.

DO NOT invent.

DO NOT silently choose a manufacturing rule.

Instead:

1. Identify the ambiguity.
2. Explain why it matters.
3. Use the smallest safe implementation only if the phase can proceed without deciding it.
4. Otherwise stop and request clarification.

This is especially important for:

    material transformation
    unit conversion
    material relationships
    manufacturing operations
    wastage
    yield
    conversion ratios
    batch behavior
    supplier relationships
    costing
    valuation

---

# 83. INVENTORY MODULE GOLDEN RULE

The most important rule in this document is:

    INVENTORY MUST ALWAYS BE TRUSTWORTHY.

If the system says:

    OHNS 31 Dia = 95 KG

a user must be able to trust that value.

The system must be able to explain:

    where the 95 KG came from
    which transactions created it
    who performed those transactions
    when they occurred
    why they occurred

This principle takes priority over convenience.

---

# 84. FINAL INVENTORY VISION

The final Inventory system should eventually become:

    A centralized,
    traceable,
    controlled,
    auditable,
    manufacturing-aware
    inventory source of truth.

Eventually:

                       INVENTORY
                           │
             ┌─────────────┼─────────────┐
             ↓             ↓             ↓
         MASTER         BALANCE        LEDGER
             │             │             │
             └─────────────┼─────────────┘
                           ↓
                   STOCK MOVEMENT
                           │
          ┌────────────────┼────────────────┐
          ↓                ↓                ↓
       STOCK IN         STOCK OUT       ADJUSTMENT
          │                │                │
          └────────────────┼────────────────┘
                           ↓
                    FUTURE WORKFLOWS
                           │
       ┌───────────────────┼───────────────────┐
       ↓                   ↓                   ↓
      RM                  STORES            PRODUCTION
       │                   │                   │
       └───────────────────┼───────────────────┘
                           ↓
                    TRACEABILITY
                           ↓
                     ANALYTICS
                           ↓
                       REPORTING

Future functionality must be added progressively and only after the corresponding business requirements are explicitly defined.

---

# END OF INVENTORY MODULE CONCEPT
