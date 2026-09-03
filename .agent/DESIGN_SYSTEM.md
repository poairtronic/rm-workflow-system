# RMRIT Design System Specification

A clean, high-density manufacturing design system focused on rapid data scanning, high contrast, and workflow clarity.

## Color Tokens & Semantics

### Neutral Grayscale

- **Background App**: `#0F172A` (Dark) / `#F8FAFC` (Light)
- **Card / Surface**: `#1E293B` (Dark) / `#FFFFFF` (Light)
- **Border Default**: `#334155` (Dark) / `#E2E8F0` (Light)
- **Text Primary**: `#F8FAFC` (Dark) / `#0F172A` (Light)
- **Text Muted**: `#94A3B8` (Dark) / `#64748B` (Light)

### Semantic Workflow Status Colors

- **Draft / Neutral**: Slate (`#64748B`)
- **Pending Action**: Amber / Warning (`#D97706`)
- **In Progress / Active**: Blue / Info (`#2563EB`)
- **Success / Complete / Available**: Emerald / Green (`#059669`)
- **Discrepancy / Rejected / Urgent**: Rose / Red (`#E11D48`)

## Typography Hierarchy

- **Font Family**: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
- **Monospace (for Numbers, Codes, SCs, Materials)**: "JetBrains Mono", "SF Mono", Consolas, monospace
- **Headings**:
  - `h1`: 24px, SemiBold (Screen Title)
  - `h2`: 18px, Medium (Section Title / SC Identifier)
  - `h3`: 15px, Medium (Card / Table Header)
- **Body & Data**: 13px–14px regular
- **Dense Data Cells**: 12px–13px tabular numbers

## Component Guidelines

- **Data Tables**: Striped/bordered, dense row padding (`8px 12px`), sticky header on scrollable containers.
- **Badges**: High contrast, pairing symbol with text (e.g. `● Active`, `✓ Issued`, `⚠ Shortage`).
- **Action Buttons**: One primary action per workflow pane (`bg-blue-600` or accent), neutral secondary actions (`border-slate-300`).
