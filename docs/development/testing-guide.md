# Testing Strategy & Guidelines

## 1. Automated Test Suites

- **Backend Unit Tests**: Run `npm test` inside `backend/` using Vitest.
- **Backend E2E Tests**: Run `npm run test:e2e` inside `backend/`.
- **Frontend Type & Build Verification**: Run `npm run build` inside `frontend/`.

## 2. Performance & Quality Checklist

- [ ] No N+1 database queries.
- [ ] All lists paginated via `PaginationDto`.
- [ ] Server-side role guards on every endpoint.
- [ ] UI tested under the Real Employee Test criteria.
