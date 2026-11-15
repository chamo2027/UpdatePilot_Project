# Windows release checklist

Run the checks on a clean supported Windows 10 or 11 machine or VM, using an ordinary Windows account. Use an expendable test application with a known WinGet update. Record Windows and WinGet versions, package ID, before and after versions, job outcome, and any limitations.

- [ ] Open the dashboard, sign in, pair the packaged agent, and see its status become online.
- [ ] Run a real scan. Compare installed versions and update candidates with WinGet output. Check empty, unknown, unmatched and unsupported cases.
- [ ] Search, filter, sort, paginate and export the inventory. Check update report versions and outcomes.
- [ ] Preview a supported update. Confirm that cancelling before approval leaves Windows unchanged. Approve and verify the exact target in both WinGet and the dashboard.
- [ ] Exercise a failed update, permission prompt, disconnect, restart and interrupted scan. Check history and rescan before attempting another update.
- [ ] Revoke the agent and confirm it cannot heartbeat, claim jobs or submit reports. Re-pair with the authorized setup code.
- [ ] Check keyboard navigation, focus, accessible labels, screen reader announcements and mobile layouts. Check both themes.
- [ ] Run the automated tests and production build. Record defects and repeat affected checks after fixes.
- [ ] Record the demo and include the package, setup instructions, API notes and test results with the release.

## Recovery and privacy

When an update times out or fails verification, check the installed version, handle any installer restart, and scan again before approving another update. Restore the database from backup if needed. To reset a test installation, stop the server and agent, remove the disposable database and agent state, then initialize a fresh database and re-pair. Back up any database whose history you need.

The local database stores device name, OS and agent versions, software inventory, timestamps, job history and diagnostic output. Keep the database, local environment files and the agent state private. Review diagnostics before sharing them because installer messages may contain local paths. Old installer output and scan snapshots are pruned after 30 days by default. Configure this with `DIAGNOSTIC_RETENTION_DAYS`. Summary history requires manual backup and deletion. If you enable OSV lookups, the API sends only the mapped upstream package name and version to OSV.
