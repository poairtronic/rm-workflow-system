# Utility and Development Scripts

This directory contains categorized automation, diagnostic, and deployment utility scripts for RMRIT.

---

## Directory Layout

```text
scripts/
├── development/
│   ├── dev-setup.js           # Validates local environment and creates .env from template
│   └── check-health.js        # Probes backend HTTP health endpoint
│
├── database/
│   └── check-db-connection.js # Validates DATABASE_URL connection string and SSL parameters
│
└── deployment/
    └── verify-build.js        # Validates production distribution artifacts in frontend/dist and backend/dist
```

---

## Usage

```bash
# Verify local environment
node scripts/development/dev-setup.js

# Check backend health
node scripts/development/check-health.js

# Validate database connection string
node scripts/database/check-db-connection.js

# Verify build outputs
node scripts/deployment/verify-build.js
```
