# UpdatePilot — Software Update Intelligence & Management Platform

UpdatePilot is a Windows-first software update intelligence platform combining a modern web dashboard with a locally installed Windows Agent to discover installed applications, compare versions against trusted update sources (WinGet), present verified release details, and execute supported updates safely under explicit user authorization.

---

## Architecture Overview

```
                                +---------------------------+
                                |  Next.js Web Dashboard    |
                                |  (App Router, Tailwind)   |
                                +-------------+-------------+
                                              |
                                     HTTP REST / API
                                              |
                                              v
+--------------------------+    +-------------+-------------+
|    Windows Host Agent    |<-->| Express API Backend Engine|
| (WinGet Discovery/Upgrade|    |  (Prisma ORM + SQLite/PG) |
+--------------------------+    +---------------------------+
```

### Components
1. **`apps/web`**: Next.js 14 Web Dashboard with Tailwind CSS, Lucide Icons, and Recharts. Features dark/light themes, live agent status telemetry, searchable application inventory, safe update review modals with real-time log viewers, and security vulnerability findings.
2. **`apps/server`**: Express.js REST API with Prisma ORM (SQLite for zero-config local operation, fully compatible with PostgreSQL). Handles job orchestration, inventory persistence, safe update validations, and audit trails.
3. **`apps/agent`**: Windows Desktop Agent integrating directly with `winget` (Windows Package Manager). Safely queries installed applications, compares versions, executes allowlisted updates, and verifies outcomes post-installation.
4. **`packages/shared`**: Shared TypeScript contracts, Zod schemas, and data models shared across all apps.

---

## Quickstart & Running Locally

### Prerequisites
- Windows 10/11
- Node.js v18+ (tested on v22)
- `winget` (Windows Package Manager installed by default on Windows 10/11)

### 1. Installation
```bash
npm install
npm --workspace=@updatepilot/shared run build
npm --workspace=@updatepilot/server run db:push
```

### 2. Start the Backend API Server
```bash
npm run dev:server
# Server starts on http://localhost:4000
```

### 3. Start the Web Dashboard
```bash
npm run dev:web
# Web UI opens on http://localhost:3000
```

### 4. Run the Windows Agent
To discover installed applications and start real-time telemetry:
```bash
npm run dev:agent
```
Or run a one-time scan:
```bash
npm --workspace=@updatepilot/agent run scan-once
```

---

## Key Features Implemented (Milestones 1 & 2)

- **Live Host Discovery**: Real-time integration with `winget list` discovers installed apps on the host machine and categorizes them into `up_to_date`, `update_available`, and `unsupported/registry`.
- **Overview Dashboard**: Fleet health donut chart, summary metrics, host machine telemetry, and live audit timeline.
- **Searchable Inventory**: Multi-attribute search (app name, package ID, publisher), filter by status/source, sorting, and pagination.
- **Application Detail View**: Detailed view showing publisher, package identifier, version info, changelog links, and package homepage links.
- **Update Center**: Displays available updates with current vs target version comparison, major version jump warnings, and changelog references.
- **Safe Update Confirmation**: Strict authorization gate requiring explicit user confirmation before any system-changing update command executes. Streams output logs and validates exit code.
- **Post-Update Verification**: Automatically re-queries package state to verify that the upgraded version is properly installed before marking success.
- **Security Insights**: Surfaces verified vulnerability advisories (CVE / OSV) mapped to matched package IDs.
- **Audit & History**: Immutable audit log of all scans, updates, and errors with export functionality to CSV and JSON.
- **Agent Pairing & Security**: Narrow, authenticated agent API with token rotation and revocation support.
