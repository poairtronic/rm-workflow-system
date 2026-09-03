# RMRIT UI Design Rules

These rules govern all frontend screen design across RMRIT. Every AI agent working on this codebase must adhere to them.

## 1. Information Priority

Priority order on every operational screen:
$$\text{SC Number} \longrightarrow \text{Status} \longrightarrow \text{Next Action} \longrightarrow \text{Materials Breakdown} \longrightarrow \text{History}$$

## 2. Status Indicators

- Status badges must pair clear iconography/symbols with text (never color alone):
  - `✓ Complete` / `✓ Available`
  - `⚠ Partially Issued` / `⚠ Additional Request`
  - `! Pending Stores` / `! Verification Required`
  - `✕ Rejected`

## 3. The 5-Second Scan Rule

A supervisor or operator looking at an SC or Dashboard screen must understand the current state and next step in under 5 seconds. Avoid cluttered multi-layer cards.

## 4. The Real Employee Test

Before marking any screen complete, verify:

- Can an operator immediately see which materials are required, issued, and pending?
- Can a manager see what action is required from them right now?
- Is navigation minimal, avoiding bouncing between multiple disconnected tabs?

## 5. Mobile & Touch Ergonomics

Stores and Production operators may use touch tablets on the shop floor. Ensure touch targets are at least 44px and responsive layouts do not wrap critical identifiers awkwardly.
