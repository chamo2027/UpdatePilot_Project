# Deploy UpdatePilot

This project uses Neon PostgreSQL, Render for the API, and Vercel for the dashboard.

## 1. Create the Neon database

1. Create a Neon project in the region closest to the Render service.
2. Copy the pooled PostgreSQL connection string from the Neon dashboard.
3. Keep the connection string private. It belongs only in Render environment variables and any local server environment file.

## 2. Deploy the API on Render

Create a **Web Service**, not a Blueprint.

| Setting | Value |
| --- | --- |
| Repository | `chamo2027/UpdatePilot_Project` |
| Branch | `main` |
| Root Directory | Leave blank |
| Runtime | Node |
| Build Command | `npm ci && npm --workspace=@updatepilot/shared run build && npm --workspace=@updatepilot/server run db:generate && npm --workspace=@updatepilot/server run build && npm --workspace=@updatepilot/server run db:migrate` |
| Start Command | `node apps/server/dist/index.js` |
| Health Check Path | `/health` |
| Instance Type | Free |

Create these environment variables on Render:

| Name | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Neon pooled PostgreSQL connection string |
| `DASHBOARD_PASSWORD` | A private password with at least 12 characters |
| `SESSION_SECRET` | A different random value with at least 32 characters |
| `AGENT_PAIRING_CODE` | A different random value with at least 24 characters |
| `ENABLE_OSV_ADVISORIES` | `true` or `false` |
| `DIAGNOSTIC_RETENTION_DAYS` | `30` |
| `DASHBOARD_ORIGIN` | Add the Vercel production URL after step 3 |

Render supplies `PORT`. The server already listens on Render's host and port, so do not add `PORT` or `HOST`.

Deploy the API and copy its URL, for example `https://updatepilot-server.onrender.com`. Open `/health` on that URL and confirm it returns JSON with `status: "ok"`.

## 3. Deploy the dashboard on Vercel

Import the same GitHub repository. Keep the Vercel project root at the repository root so npm can access the shared workspace.

| Setting | Value |
| --- | --- |
| Framework Preset | Next.js |
| Install Command | `npm ci` |
| Build Command | `npm --workspace=@updatepilot/shared run build && npm --workspace=@updatepilot/web run build` |
| Output Directory | Leave blank |

Add this Vercel Production environment variable before deploying:

| Name | Value |
| --- | --- |
| `API_INTERNAL_URL` | The Render API URL, for example `https://updatepilot-server.onrender.com` |

Deploy Vercel and copy its production URL. Add that exact URL as `DASHBOARD_ORIGIN` on Render, then manually redeploy the Render API.

## 4. Connect the Windows agent

On the Windows computer that UpdatePilot should scan, create or update `apps/agent/.env.local`:

```text
SERVER_URL=https://YOUR-RENDER-SERVICE.onrender.com/api/v1
AGENT_PAIRING_CODE=the-same-private-code-from-Render
```

Run:

```powershell
npm.cmd run dev:agent
```

After the agent pairs successfully, remove `AGENT_PAIRING_CODE` from its local file. It keeps its device credential in `.agent_state.json`.

## 5. Verify the deployment

1. Open the Vercel URL and sign in.
2. Confirm the device status is online.
3. Run a scan and confirm applications appear.
4. Open the API health URL.
5. Test an application update only with a suitable, non-critical application.

Render Free web services spin down after idle time. The first request after that can take longer while the API wakes up.
