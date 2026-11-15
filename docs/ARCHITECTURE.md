# UpdatePilot Architecture Documentation

UpdatePilot is a Windows-first software update intelligence and management platform. It combines a Next.js web operations dashboard with a lightweight Windows desktop daemon to provide software discovery, update comparison, and operator-confirmed installations.

## High-Level Architecture Diagram

```mermaid
flowchart TD
    subgraph OperatorLayer["Operator Interface"]
        Browser["Next.js Web Dashboard<br/>(React 18 / Tailwind CSS)"]
    end

    subgraph ServerLayer["Backend API & Orchestration"]
        API["Express API Server<br/>(Node.js 22 / TypeScript)"]
        AccessCtrl["Access & Session Controller<br/>(HTTP-only Cookies / HMAC-SHA256)"]
        JobOrch["Background Job Orchestrator<br/>(Scan & Update State Machines)"]
        Swagger["OpenAPI 3.0 / Swagger UI<br/>(/api-docs & /openapi.json)"]
        SecurityMod["Security Intelligence Module<br/>(OSV Advisory Query)"]
    end

    subgraph DataLayer["Persistence & Storage"]
        Prisma["Prisma ORM"]
        Database[("SQLite (Local-First) /<br/>PostgreSQL (Production)")]
    end

    subgraph HostLayer["Target Windows Machine"]
        Agent["UpdatePilot Windows Agent<br/>(Node.js Daemon)"]
        WinGet["Windows Package Manager<br/>(winget.exe)"]
        AppStore["WinGet Community Repository<br/>& Trusted Metadata"]
        OSV["OSV Vulnerability Database<br/>(api.osv.dev)"]
    end

    Browser <-->|HTTP REST + Session Cookie| API
    API --> AccessCtrl
    API --> JobOrch
    API --> Swagger
    API --> SecurityMod
    JobOrch <--> Prisma
    Prisma <--> Database
    SecurityMod -.->|HTTPS Query| OSV

    Agent <-->|Bearer Token Auth / Long-Poll & Heartbeat| API
    Agent <-->|CLI Subprocess (Allowlisted)| WinGet
    WinGet <-->|HTTPS Package Manifests| AppStore
```

## Component Breakdown

### 1. Web Client (`apps/web`)
* **Framework**: Next.js 14 (App Router) + React 18 + TypeScript.
* **Styling**: Tailwind CSS with custom design tokens for light and dark operational themes.
* **Components**: Accessible component primitives, Lucide icons, and Recharts for fleet health visualization.
* **Security**: Enforces strict origin checking, CSRF mitigation via custom headers, and keyboard accessible modal focus trapping (`useModalFocus`).

### 2. API Server (`apps/server`)
* **Runtime**: Node.js 22 + TypeScript + Express.
* **Security & Access**:
  * Helmet security headers.
  * Constant-time secret comparison (`timingSafeEqual`) to prevent timing side-channel attacks.
  * HTTP-only, SameSite=Strict cryptographic session cookies for the dashboard operator.
  * Hashed bearer tokens for agent communication.
* **Job Orchestration**:
  * Persistent job states: `pending_confirmation` → `queued` → `in_progress` → `succeeded` / `failed` / `cancelled` / `restart_required`.
  * Automatic expiration of orphaned jobs (5-minute scan timeout, 20-minute update timeout).
  * Automated diagnostic retention pruning (30 days default).
* **API Documentation**: OpenAPI 3.0 specification available at `/api/v1/openapi.json` and interactive Swagger UI at `/api-docs`.

### 3. Windows Agent (`apps/agent`)
* **Runtime**: Bundled single-file CommonJS executable with Node.js runtime and PowerShell packaging.
* **Execution Model**:
  * Zero shell evaluation: Executes only allowlisted fixed command sequences via `child_process.spawn`.
  * Pre-execution validation: Validates package ID pattern, ensures target version conforms to semver/version pattern, and checks that currently installed version matches baseline.
  * Post-update verification: Re-queries `winget list --exact` to verify the actual installed binary version before reporting success.
  * Reboot handling: Detects Windows installer restart codes (`3010`, `1641`) and marks jobs as `restart_required`.

### 4. Database Layer (`apps/server/prisma`)
* **ORM**: Prisma with foreign keys, compound indexes, and cascade deletion where appropriate.
* **Engines**: Local-first SQLite (`pilot.db`) with complete compatibility for PostgreSQL via Docker Compose.
* **Entities**: `User`, `Device`, `Application`, `ReleaseMetadata`, `ScanJob`, `UpdateJob`, `SecurityFinding`, `AuditEvent`.

