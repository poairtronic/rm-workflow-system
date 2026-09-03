# RMRIT System Requirements

## 1. Project Scope & Objective
RMRIT is an internal manufacturing **raw-material workflow and traceability application** designed to replace manual, physical paper-based RM tracking with an immutable, verified digital chain of custody.

## 2. Core Functional Requirements
1. **PO & SC Structure**:
   - PO is a commercial reference.
   - SC (Sales Order Component) is the operational unit of work, approval, and completion.
2. **Raw Material Specification**:
   - Supports material grades (`EN31`, `OHNS`, `MS`, etc.), types (Round Bar, Plate, Tube), and dimensions (`Ø110×35`, `Length`, `Width`, `Thickness`, `Weight`).
3. **Approval Flow**:
   - Two-tier workflow: Design creation followed by Senior Manager verification/rejection.
4. **Stores Material Issue**:
   - Availability checking, full issuance, and partial issuance with pending tracking.
5. **Production Control**:
   - Physical receipt acknowledgment, material consumption, scrap/return logging, and additional material requests.
6. **Immutable Audit Trail**:
   - Every movement is append-only with user attribution and timestamping.
