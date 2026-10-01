---
name: rm-workflow-roadmap
description: Strict guidelines and master roadmap for RMRIT application development (Phases 17-24). Enforces the Baseline Lock, No-Overlap rules, and Backend-First sequence.
---

# RMRIT Master Development Roadmap & Guidelines

This skill defines the mandatory execution model, architectural boundaries, and phase-wise roadmap for the RMRIT application development. All agents and subagents must adhere to these rules when building or modifying code for this project.

## 1. The Baseline Lock (Phases 1–16)

**Current Status:** Phase 1 → 16.12 is COMPLETED and locked.
These phases include Authentication, RBAC, SC (Style Code), PO (Purchase Order), RM (Raw Material) Lifecycle, Inventory foundation, Notifications, and Emails.

**RULE:** The baseline is protected. You must NOT rebuild, duplicate, or replace any existing module. We maintain a single source of truth (especially for inventory and master data).

## 2. The No-Overlap Control System

Before writing any code, every agent must perform an **Overlap Check** and structure their approach using this 4-step paradigm:

1. **REUSE:** Identify existing components/APIs/Entities that satisfy the requirement.
2. **EXTEND:** If an existing component needs minor changes to support a new requirement, extend it carefully with regression testing.
3. **NEW:** Only build genuinely new entities/services if no existing module provides the capability.
4. **DO NOT TOUCH:** Explicitly identify certified modules that must remain unchanged.

### Pre-Coding Overlap Check Example
```text
Existing capability: [Search codebase for similar concepts]
New requirement: [Define new need]
Overlap: [Yes/No]
Decision: [Reuse/Extend/Build New]
```

## 3. The Execution Sequence (Backend First)

We do not mix frontend polishing with unfinished backend business logic. 
The strict execution model for every phase is:

`Requirement → Database → Entity → DTO → Service → Business Rules → Controller/API → RBAC → Backend Tests → API Validation → Backend Sign-off`

**Frontend work is forbidden until the entire Backend Certification Gate (Phase 20 exit) is passed.**

## 4. Master Roadmap (Phases 17–24)

### PART A — BACKEND COMPLETION

*   **PHASE 17: General Material Issue + MSL Automation**
    *   *General Issue:* Non-SC/Non-PO inventory stock-out logic, transaction ledger, atomic deduction.
    *   *MSL Engine:* Low-stock/out-of-stock evaluation, duplicate alert suppression, extending existing notification/email systems. Scheduled & movement-based triggers.
*   **PHASE 18: Production Process Master + Vendor Master**
    *   *Process Master:* Process sequences, validation, uniqueness.
    *   *Vendor Master:* Vendor creation, capability mapping, SLA foundation.
*   **PHASE 19: Delivery Challan (DC) Module**
    *   *Type 1 (Production Process Outward):* SC/PO -> Process -> Vendor -> DC -> Return -> Verification.
    *   *Type 2 (General Inventory Outward):* Inventory -> Vendor -> DC -> Return -> Verification.
    *   *Features:* Vendor custody accounting, returns, status engine, SLA (overdue tracking), notifications, printable DC backend data.
*   **PHASE 20: SC / PO / Vendor Traceability & Reporting Backend**
    *   *APIs:* Final RM Usage, Open/Closed RM, Consolidated SC Traceability, Consolidated PO Traceability, Vendor Performance/DC Ageing analytics.

### PART B — BACKEND CERTIFICATION GATE
A hard stop. Every requirement from Phases 17-20 must have proven: DB, Business Logic, API, RBAC, Validation, Audit, and Automated Tests.

### PART C — FRONTEND & INTEGRATION
*   **PHASE 21: Frontend Completion** (Building UI against certified APIs).
*   **PHASE 22: Frontend ↔ Backend Integration** (Wiring React to NestJS, testing full data flow).
*   **PHASE 23: Full Application E2E Test** (Testing the complete RMRIT business flow, RM path, general inventory path, MSL path, traceability path).
*   **PHASE 24: Final Hardening, UAT, and Release Certification** (Regression, role testing, concurrency, stock integrity).

## 5. Instructions for Agents / Subagents

1. **Locate Current Phase:** Always confirm with the user which Phase and Sub-phase is currently active.
2. **Backend Only (Phases 17-20):** Do not generate or modify React/Frontend code until the Backend Certification Gate is explicitly passed.
3. **Enforce Overlap Checks:** Always search the codebase (`grep_search`, `list_dir`) for existing implementations before creating new services or database tables.
4. **Test Everything:** Provide backend tests (e.g., Jest, Supertest) for every new service and API endpoint.
