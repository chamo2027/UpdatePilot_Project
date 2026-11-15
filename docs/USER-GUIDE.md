# UpdatePilot User Guide & Troubleshooting Manual

This guide provides end-to-end instructions for deploying, pairing, operating, and troubleshooting UpdatePilot on a Windows computer.

---

## 1. System Requirements

* **Operating System**: Windows 10 (version 1809 or higher) or Windows 11.
* **Prerequisites**:
  * [Windows Package Manager (WinGet)](https://learn.microsoft.com/windows/package-manager/winget/) installed and accessible from PowerShell.
  * Node.js 22 LTS installed.
* **Network**: Standard local loopback (`127.0.0.1`) network connectivity. No paid external APIs or cloud subscriptions required.

---

## 2. Installation & First-Time Setup

### Step 1: Start the Backend & Database
1. Open PowerShell in the project directory:
   ```powershell
   npm.cmd ci
   npm.cmd --workspace=@updatepilot/shared run build
   ```
2. Generate environment secrets:
   ```powershell
   Copy-Item apps/server/.env.example apps/server/.env.local
   Copy-Item apps/agent/.env.example apps/agent/.env.local
   ```
   Set strong random strings for `DASHBOARD_PASSWORD`, `SESSION_SECRET`, and `AGENT_PAIRING_CODE` in `apps/server/.env.local`. Copy the `AGENT_PAIRING_CODE` into `apps/agent/.env.local`.

3. Initialize the database schema:
   ```powershell
   npm.cmd --workspace=@updatepilot/server run db:generate
   npm.cmd --workspace=@updatepilot/server run db:migrate
   ```

4. Start the server:
   ```powershell
   npm.cmd run dev:server
   ```
   The API will listen on `http://127.0.0.1:4000`. Interactive OpenAPI documentation is available at `http://127.0.0.1:4000/api-docs`.

### Step 2: Start the Web Dashboard
In a separate terminal:
```powershell
npm.cmd run dev:web
```
Open `http://localhost:3000` in your web browser and sign in with the configured `DASHBOARD_PASSWORD`.

### Step 3: Run the Windows Agent
In a third terminal:
```powershell
npm.cmd run dev:agent
```
The agent will:
1. Connect to the API server and securely pair using the pairing code.
2. Save its persistent token to `.agent_state.json`.
3. Perform an initial live WinGet inventory scan and send the discovered applications to the dashboard.
4. Begin periodic heartbeat and job polling.

---

## 3. Core Workflows

### Discovering Updates
1. On the **Overview** dashboard, check the **Updates Available** card.
2. To trigger a manual inventory scan, click **Run Full Host Scan** in the top header or host panel.
3. Once completed, navigate to the **Application Inventory** or **Update Center** tab.

### Reviewing and Authorizing an Update
1. In the **Update Center** (`/updates`), click **Review & Update** on the desired package.
2. A **Safe Update Confirmation** modal will display:
   * Target package name and exact package identifier.
   * Currently installed version vs. proposed upgrade version.
   * Major version jump warnings (if applicable).
3. Review the details, check the mandatory authorization box:
   `I explicitly authorize UpdatePilot to execute this update...`
4. Click **Confirm & Update**.
5. The dashboard enters a live tracking view. The agent claims the job, executes the allowlisted WinGet upgrade, re-scans the system, and verifies the version.
6. When verified, a green confirmation card is presented and the inventory is updated.

---

## 4. Handling Reboot-Required Updates

Certain Windows updates (such as kernel drivers, runtimes, or system tools like Git, VS Code, or .NET) require a system reboot to replace locked files.

* When WinGet returns exit code `3010` (`ERROR_SUCCESS_REBOOT_REQUIRED`) or `1641`:
  * The UpdatePilot job transitions to **System Restart Required**.
  * An amber status badge is displayed with diagnostic notes.
  * The operator should reboot Windows when convenient and click **Run Full Host Scan** afterwards to finalize verification.

---

## 5. Troubleshooting & FAQ

### Issue: Agent pairing fails
* **Symptoms**: Agent console reports `Could not pair with server. Ensure backend is running.`
* **Solution**:
  1. Confirm `apps/server` is running and accessible at `http://127.0.0.1:4000/health`.
  2. Verify that `AGENT_PAIRING_CODE` in `apps/agent/.env.local` matches `apps/server/.env.local`.
  3. If re-pairing after revocation, delete `.agent_state.json` in `apps/agent` and restart the agent.

### Issue: WinGet scan returns "WinGet inventory format was not recognized"
* **Solution**: Ensure WinGet is functional by running `winget list` directly in PowerShell. If prompted to accept source agreements, run `winget list --accept-source-agreements` once in an ordinary terminal.

### Issue: Update fails with exit code 1603
* **Explanation**: Windows Installer exit code `1603` denotes a fatal error during installation. This commonly happens when the installer requires administrative elevation (UAC prompt) or an existing instance of the application is currently running.
* **Solution**: Close the application if open, or run the UpdatePilot agent from an elevated (Administrator) PowerShell prompt to permit system installers to run.

### Issue: Resetting the Environment
To reset the test environment and start completely fresh:
```powershell
# Stop all processes
Remove-Item -Force apps/server/pilot.db, apps/server/pilot.db-journal -ErrorAction SilentlyContinue
Remove-Item -Force apps/agent/.agent_state.json -ErrorAction SilentlyContinue
npm.cmd --workspace=@updatepilot/server run db:migrate
```

