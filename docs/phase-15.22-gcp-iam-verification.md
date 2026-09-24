# PHASE 15.22 — GCP IAM VERIFICATION REPORT

## 1. Objective
Perform a read-only verification of the Google Cloud Project, IAM policy, OAuth credentials, service accounts, and security controls for the RMRIT Phase 15 Gmail API email infrastructure, and evaluate whether the GCP IAM verification limitation documented in Phase 15.21 can be formally closed.

## 2. Verification Environment
- **Repository Path:** `c:\Users\Admin\OneDrive\Desktop\rm-workflow-system`
- **Execution Host OS:** Windows PowerShell
- **Node.js Environment:** Active
- **Vitest Test Runner:** Active (`v4.1.11`)
- **gcloud CLI Status:** **NOT INSTALLED** (`CommandNotFoundException`)
- **Application Code Modification Status:** 0 lines modified (Pure read-only verification)

## 3. RMRIT Google Cloud Project
- **Discovered Environment Variables (backend/.env):**
  - `GMAIL_CLIENT_ID`: `51588410221-ml7sqlcebbf9henl8p03r88d5pndh8i5.apps.googleusercontent.com`
  - `GMAIL_CLIENT_SECRET`: Present (`[REDACTED]`)
  - `GMAIL_REFRESH_TOKEN`: Present (`[REDACTED]`)
  - `GMAIL_SENDER_EMAIL`: `posuppportairtronic@gmail.com`
- **Documented GCP Project Display Name (.agent/PHASE_15_17_GOOGLE_CLOUD_CONFIGURATION_REPORT.md):** `MERC Production Mail`

## 4. Project Isolation Verification
- **Status:** **NEEDS REVIEW / FINDING IDENTIFIED**
- **Evidence:** Section 3 of Phase 15.22 rules mandates that RMRIT must use its own dedicated Google Cloud project and must not share or reuse MERC project resources, OAuth clients, or credentials.
- **Finding:** Existing Phase 15.17 documentation lists the GCP Project Display Name as `MERC Production Mail`. While the OAuth Client ID (`51588410221-...`) and sender email (`posuppportairtronic@gmail.com`) function for RMRIT mail sending, the project naming indicates potential shared legacy project allocation.

## 5. Gmail API Verification
- **Runtime Provider:** `GmailApiProvider` (`src/email/providers/gmail-api.provider.ts`)
- **Transport Mechanism:** HTTPS / 443 to `gmail.googleapis.com` via official `googleapis` Node.js library
- **Requested Scope:** `https://www.googleapis.com/auth/gmail.send` (Least privilege scope for mail dispatch)
- **Remote GCP Service API Status (`gcloud services list`):** **BLOCKED** — Cannot query remote GCP API status because `gcloud` CLI is not installed in local environment.

## 6. IAM Policy Verification
- **Remote IAM Inspection (`gcloud projects get-iam-policy`):** **BLOCKED** — `gcloud` CLI binary is unavailable in host shell.
- **Required Roles:** `roles/viewer` (minimum for project inspection), no elevated project `roles/owner` or `roles/editor` should be assigned to non-admin service accounts.

## 7. Service Account Verification
- **Remote Service Account Inspection (`gcloud iam service-accounts list`):** **BLOCKED** — `gcloud` CLI binary is unavailable in host shell.
- **User-Managed Keys:** Cannot scan remote service account key IDs or creation dates via CLI.
- **Source Code Key Check:** Zero service account private key JSON files (`.json`) or PEM keys exist in source code or committed artifacts.

## 8. OAuth Client Verification
- **Client ID:** `51588410221-ml7sqlcebbf9henl8p03r88d5pndh8i5.apps.googleusercontent.com`
- **Client Type:** Web Application / Server-Side OAuth 2.0 (`google.auth.OAuth2`)
- **Authorized Sender:** `posuppportairtronic@gmail.com`
- **Secrets Isolation:** Backend-only environment variable (`GMAIL_CLIENT_SECRET`). Zero exposure in frontend code or database tables.

## 9. Secret Exposure Verification
- **Repository Secret Scan Results:**
  - `backend/src/`: Zero hardcoded client secrets, refresh tokens, or private keys found.
  - `frontend/src/`: Zero Google OAuth secrets found.
  - `frontend/dist/`: Zero Google OAuth secrets in production client build bundles.
  - `email_jobs` & `email_logs` database tables: Zero OAuth credentials stored.
  - Console Logging & Error Traces: Sanitized via `GmailApiProvider.maskSecrets()` and `EmailAuditService.sanitizeError()`.

## 10. Least-Privilege Findings
- **Granted Scope:** `https://www.googleapis.com/auth/gmail.send` (Strict minimum scope required for sending emails).
- **Unnecessary Scopes:** Overbroad scopes (`gmail.readonly`, `gmail.modify`, `mail.google.com`, Drive, Calendar) are NOT requested or used.
- **Remote GCP IAM Least Privilege:** Unverified due to lack of `gcloud` CLI tooling.

## 11. Cross-Project Verification
- **RMRIT Project vs. MERC Project Comparison:**
  - `GMAIL_SENDER_EMAIL`: `posuppportairtronic@gmail.com` (Dedicated RMRIT email)
  - `GCP Project Name`: `MERC Production Mail` (Legacy/Shared project title in Phase 15.17 metadata)
- **Status:** **UNVERIFIED / REQUIRES GCP CONSOLE REVIEW** — Remote GCP project ownership cannot be queried programmatically without `gcloud` CLI.

## 12. Application Regression Verification
- **Phase 15.21 Regression Suite (`phase-15-21-final-phase15-certification.spec.ts`):** **25/25 PASSED** (Execution duration: ~9.21s)
- **Backend Build (`npm --prefix backend run build`):** **0 ERRORS**
- **Frontend Build (`npm --prefix frontend run build`):** **0 ERRORS**
- **Backend Lint (`npm --prefix backend run lint`):** **0 ERRORS**

## 13. Findings
1. **FINDING-15.22-01 (Tooling Dependency):** The `gcloud` CLI tool is not installed on the execution environment host shell. As a result, direct CLI queries (`gcloud projects get-iam-policy`, `gcloud services list`, `gcloud iam service-accounts list`) cannot be executed automatically.
2. **FINDING-15.22-02 (Project Naming & Isolation Review):** Existing Phase 15.17 documentation lists GCP Project Display Name as `MERC Production Mail`. While the OAuth client and sender account (`posuppportairtronic@gmail.com`) function correctly for RMRIT notification delivery, GCP Console review is recommended to confirm whether a standalone GCP project (e.g. `rmrit-production-mail`) should be created to ensure complete resource isolation from MERC.

## 14. Remaining Limitations
- **Remote GCP IAM & Service Account Inspection:** Direct programmatic verification of remote GCP IAM bindings, service account roles, and OAuth client project ownership remains unavailable from the local shell environment due to the absence of the `gcloud` CLI tool.

## 15. Final Certification

PHASE 15.22 — GCP IAM VERIFICATION REPORT

RESULT:
VERIFICATION BLOCKED

---
*Manual Unblock Instructions:*
To close this limitation in a future administrative audit, install the Google Cloud SDK (`gcloud` CLI) on the host machine, run `gcloud auth login`, set the active project via `gcloud config set project <RMRIT_PROJECT_ID>`, and execute `gcloud projects get-iam-policy <RMRIT_PROJECT_ID>`.
