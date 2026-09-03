# API Architecture & Endpoint Standards

## Standard Route Conventions

- Global health probe: `GET /api/health`
- Auth endpoints: `POST /api/auth/token`, `GET /api/auth/roles`, `GET /api/auth/me`
- Resource routes: `/api/<resource-name>` (e.g. `/api/customers`, `/api/sc`, `/api/material-issue`)

## Response Envelope

```json
{
  "data": { ... },
  "statusCode": 200
}
```

## Error Envelope

```json
{
  "statusCode": 400,
  "timestamp": "2026-09-03T12:00:00.000Z",
  "path": "/api/material-issues",
  "error": {
    "message": "Required quantity cannot exceed available stock."
  }
}
```
