# RMRIT System Requirements

## 1. Project Scope & Objective

RMRIT is an internal manufacturing **raw-material workflow and traceability application** designed to replace manual, physical paper-based RM tracking with an immutable, verified digital chain of custody.

## 2. Core Functional Requirements

1. **PO & SC Structure**:
   - PO is an external commercial reference.
   - SC (Sales Order Component) is the operational unit of work, material allocation, and completion.
2. **Raw Material Specification**:
   - Supports material grades (`EN31`, `OHNS`, `MS`, etc.), types (Round Bar, Plate, Tube), and dimensions (`Ø110×35`, `Length`, `Width`, `Thickness`, `Weight`).
3. **Direct Workflow Handover**:
   - Streamlined workflow: Designer creates and submits RM list directly to Stores.
   - Senior Manager and General Manager monitor operations via real-time alerts and analytics without approval gates.
4. **Stores Material Issue**:
   - Availability checking, full issuance, and partial issuance with pending shortage tracking.
5. **Production Control**:
   - Physical receipt acknowledgment, material consumption, scrap/return logging, and additional material requests.
6. **Immutable Audit Trail**:
   - Every movement is append-only with user attribution and timestamping.
