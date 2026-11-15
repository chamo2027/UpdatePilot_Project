# UpdatePilot API

The local Express server listens on `127.0.0.1:4000`. The dashboard proxies `/api/v1` through its own origin. Dashboard requests use an HTTP-only session cookie. Dashboard mutations must include the configured dashboard Origin. Agent requests use a bearer credential issued at pairing. The server derives the device identity from that credential.

## Dashboard

- `POST /session` accepts `{ "password": "…" }` and sets the session cookie. `GET /session` checks it and `DELETE /session` clears it.
- `GET /dashboard`, `GET /devices`, `POST /devices/:id/revoke` expose summary metrics and device management.
- `POST /devices/:id/scans` queues a scan. `GET /scans/:id` returns its state and timestamps.
- `GET /applications` accepts search, deviceId, source, status, sortBy, sortOrder, page and pageSize. `GET /applications/:id` returns application details.
- `GET /updates` lists available updates. `POST /updates/:id/preview` returns the package, installed version, and proposed target. `POST /updates/:id/execute` requires applicationId, targetVersion, and confirmedByUser. `GET /jobs/:id` returns progress and verification. `POST /jobs/:id/cancel` cancels a queued update before it is claimed.
- `GET /history` returns recent audit events. `GET /reports/inventory` and `GET /reports/updates` supply complete export datasets.
- `GET /security/findings` lists matches from the optional OSV adapter. Initial coverage is limited to stable GitHub CLI 2.x releases. An empty response may indicate disabled or unavailable coverage.

## Agent

- `POST /devices/pair` accepts deviceName, osVersion, agentVersion and either the setup pairingCode or an existing pairingToken. Save the returned token in private local storage.
- `POST /agent/heartbeat` updates presence. `GET /agent/jobs/pending` claims a queued job and returns null when idle.
- `POST /agent/scans` starts an agent-initiated scan. `POST /agent/scans/report` accepts scanJobId, deviceId, applications, and optional error.
- `POST /agent/updates/report` accepts jobId, exitCode, outputLogs, verifiedInstalledVersion, and verificationPassed. An active job is required and the server independently checks the reported version against its approved target.

Dashboard and agent requests normally return JSON with success and data. Inventory pagination returns items, total, page, and totalPages at the top level. A rejected request returns an HTTP error status with details where available.
