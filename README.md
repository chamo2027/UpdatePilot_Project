# UpdatePilot

UpdatePilot is a local Windows software inventory and update dashboard. The Windows agent uses WinGet to discover installed applications and report supported updates. The dashboard lets the operator review a target, approve it, and inspect the resulting version and job history.

```text
Browser → Next.js dashboard → Express API → Prisma / SQLite
                                  ↕
                           Windows agent → WinGet
```

The web app is in `apps/web`, the API in `apps/server`, the Windows agent in `apps/agent`, and shared TypeScript contracts in `packages/shared`.

## Local setup

Use Windows 10 or 11 with WinGet available in a normal PowerShell window, and Node.js 22. Open PowerShell in the project root.

```powershell
npm.cmd ci
npm.cmd --workspace=@updatepilot/shared run build
if (-not (Test-Path apps/server/.env.local)) { Copy-Item apps/server/.env.example apps/server/.env.local }
if (-not (Test-Path apps/agent/.env.local)) { Copy-Item apps/agent/.env.example apps/agent/.env.local }
```

Run the following three times for three different random values:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

In `apps/server/.env.local`, set `DASHBOARD_PASSWORD`, `SESSION_SECRET`, and `AGENT_PAIRING_CODE`. Copy the pairing code into `apps/agent/.env.local`. Keep these files private. SQLite is the default local database. The application binds to loopback and is designed for one trusted local operator.

For a fresh install, apply the migrations:

```powershell
npm.cmd --workspace=@updatepilot/server run db:generate
npm.cmd --workspace=@updatepilot/server run db:migrate
```

For production, set `DATABASE_URL` to the pooled PostgreSQL connection string from Neon. The Prisma schema and migrations are configured for PostgreSQL. Existing local SQLite databases are not compatible and should be retained only as backups.

For a labelled demo database, use a separate Neon database or branch, run the migration, then run the seed command. Keep it separate from the real Windows acceptance test.

Run these commands in three separate terminals, in order:

```powershell
npm.cmd run dev:server
npm.cmd run dev:web
npm.cmd run dev:agent
```

Open [the local dashboard](http://localhost:3000), sign in, and wait for the agent's initial scan. Remove the pairing code from the agent's local environment file after it has saved a working credential. Rotate the server setup code after pairing if you need to invalidate the old setup code. Keep the agent running while using the dashboard. Run a scan without leaving the agent running with `npm.cmd --workspace=@updatepilot/agent run scan-once`.

## Build and test

```powershell
npm.cmd test
npm.cmd run build
npm.cmd --workspace=@updatepilot/agent run package:windows
```

The agent package is `apps/agent/dist/UpdatePilot-Windows-Agent.zip`. Extract it to a private folder and follow its README. It requires Node.js and WinGet. The tests use an isolated SQLite database and simulated update results. To include a real inventory scan, build the package first, set `$env:UPDATEPILOT_LIVE_SCAN = '1'`, and run `npm.cmd test` again. That check reads the local inventory and performs no updates.

After building the web app, set `UPDATEPILOT_BROWSER_SMOKE=1` to include a Playwright browser smoke test. Provide `UPDATEPILOT_PLAYWRIGHT_PATH` if Playwright is installed outside the project, and `UPDATEPILOT_CHROMIUM_PATH` if using an installed Chrome or Edge executable. Leave ports 4000 and 3210 available for this test. You can set `UPDATEPILOT_WEB_DIST_DIR` to use a separate build folder for both the build and test.

The dashboard supports WinGet community packages with a known installed version and an exact target. Metadata comes from [WinGet](https://learn.microsoft.com/windows/package-manager/winget/show) where available. Release information is limited to the first twelve eligible updates per scan. WinGet text parsing currently expects English headings. An installer may require user interaction or a restart. Scan again before retrying an unverified update.

Set `SCAN_INTERVAL_MINUTES` in the agent's local environment to enable periodic scans while it is running. Browser notifications can be enabled from Settings and require the dashboard to be open. Set `ENABLE_OSV_ADVISORIES=true` on the server to opt in to [OSV](https://google.github.io/osv.dev/post-v1-query/) advisory matching for supported package installations.

## Docker & PostgreSQL (Optional Production Setup)

To run the PostgreSQL database and backend server via Docker Compose:

```powershell
docker compose up -d
```

This starts PostgreSQL on port `5432` with persistent storage in the `pgdata` volume and the API server on port `4000`.

## Interactive API Documentation

When the server is running, visit the interactive Swagger UI at:
* **Interactive UI**: [http://127.0.0.1:4000/api-docs](http://127.0.0.1:4000/api-docs)
* **OpenAPI 3.0 Spec**: [http://127.0.0.1:4000/api/v1/openapi.json](http://127.0.0.1:4000/api/v1/openapi.json)

## Documentation & Reference

* [Architecture & System Flow](docs/ARCHITECTURE.md)
* [Security, Privacy & Safe Update Policy](docs/SECURITY-PRIVACY.md)
* [UI/UX Design System & Screen Specifications](docs/DESIGN-SYSTEM.md)
* [User Guide & Troubleshooting Manual](docs/USER-GUIDE.md)
* [API Reference](docs/API.md)
* [Windows Release Checklist & Acceptance](docs/RELEASE-CHECKLIST.md)
