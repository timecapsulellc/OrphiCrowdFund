# OrphiChain Analytics Backend

This backend service provides off-chain analytics and reporting for the OrphiChain CrowdFund platform.

## Features
- REST API for analytics summary and event ingestion
- Designed for integration with a database (MongoDB, PostgreSQL, etc.)
- Extendable for custom analytics, reporting, and dashboards

## Endpoints
- `GET /api/analytics/summary` — Returns analytics summary (to be implemented)
- `POST /api/analytics/event` — Ingests analytics events (to be implemented)

## Setup
1. Install dependencies: `npm install express cors`
2. Start server: `node index.js`
3. Extend with database and analytics logic as needed

---
