import fs from 'fs';
import path from 'path';
import { getSystemInfo } from './systemInfo';
import { WingetService } from './winget';

const STATE_FILE = path.join(__dirname, '..', '.agent_state.json');

export class AgentClient {
  private serverUrl: string;
  public deviceId: string | null = null;
  public token: string | null = null;

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl.replace(/\/$/, '');
    this.loadState();
  }

  private loadState() {
    try {
      if (fs.existsSync(STATE_FILE)) {
        const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
        this.deviceId = data.deviceId;
        this.token = data.token;
      }
    } catch {
      // Ignore state load error
    }
  }

  private saveState(deviceId: string, token: string) {
    this.deviceId = deviceId;
    this.token = token;
    try {
      fs.writeFileSync(STATE_FILE, JSON.stringify({ deviceId, token }, null, 2));
    } catch (e) {
      console.warn('Could not persist agent state to disk:', e);
    }
  }

  async pair(): Promise<boolean> {
    const sysInfo = getSystemInfo();
    console.log(`[Agent] Pairing with server at ${this.serverUrl}...`);

    try {
      const res = await fetch(`${this.serverUrl}/devices/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceName: sysInfo.deviceName,
          osVersion: sysInfo.osVersion,
          agentVersion: sysInfo.agentVersion,
          pairingToken: this.token || undefined,
        }),
      });

      const json: any = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Pairing rejected by server');
      }

      this.saveState(json.data.deviceId, json.data.token);
      console.log(`[Agent] Successfully paired as device: ${json.data.name} (ID: ${json.data.deviceId})`);
      return true;
    } catch (err: any) {
      console.error(`[Agent] Pairing failed: ${err.message}`);
      return false;
    }
  }

  async heartbeat() {
    if (!this.deviceId) return;
    try {
      await fetch(`${this.serverUrl}/agent/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
        },
        body: JSON.stringify({ deviceId: this.deviceId }),
      });
    } catch {
      // Heartbeat silent failure
    }
  }

  async runScan(scanJobId?: string) {
    if (!this.deviceId) return;

    console.log('[Agent] Initiating live WinGet application inventory discovery...');
    try {
      const apps = await WingetService.listInstalledApplications();
      console.log(`[Agent] Discovered ${apps.length} applications on local host.`);

      // If no explicit scanJobId provided, request one
      let jobId = scanJobId;
      if (!jobId) {
        const createRes = await fetch(`${this.serverUrl}/devices/${this.deviceId}/scans`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        const createJson: any = await createRes.json();
        jobId = createJson?.data?.id;
      }

      if (!jobId) {
        throw new Error('Failed to obtain a ScanJob ID from server');
      }

      // Report scan results
      const reportRes = await fetch(`${this.serverUrl}/agent/scans/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          deviceId: this.deviceId,
          scanJobId: jobId,
          applications: apps,
        }),
      });

      const reportJson: any = await reportRes.json();
      if (reportRes.ok && reportJson.success) {
        console.log(`[Agent] Scan results successfully recorded! Total: ${reportJson.data.totalApps}, Updates: ${reportJson.data.updatesFound}`);
      } else {
        console.error('[Agent] Failed to report scan results:', reportJson);
      }
    } catch (err: any) {
      console.error('[Agent] Scan failed:', err.message);
    }
  }

  async handleUpdate(job: any) {
    console.log(`[Agent] Received approved update job for ${job.applicationName} (${job.packageId})`);
    try {
      const result = await WingetService.executeUpdate(job.packageId);

      await fetch(`${this.serverUrl}/agent/updates/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          jobId: job.id,
          exitCode: result.exitCode,
          outputLogs: result.outputLogs,
          verifiedInstalledVersion: result.verifiedVersion,
          verificationPassed: result.verificationPassed,
        }),
      });

      console.log(`[Agent] Update finished for ${job.applicationName}. Verified: ${result.verificationPassed}`);
    } catch (err: any) {
      console.error(`[Agent] Update execution failed: ${err.message}`);
      await fetch(`${this.serverUrl}/agent/updates/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: job.id,
          exitCode: 1,
          outputLogs: err.message,
          verificationPassed: false,
        }),
      });
    }
  }

  async pollJobs() {
    if (!this.deviceId) return;
    try {
      const res = await fetch(`${this.serverUrl}/agent/jobs/pending?deviceId=${this.deviceId}`, {
        headers: { 'Authorization': `Bearer ${this.token}` },
      });
      const json: any = await res.json();
      if (res.ok && json.success && json.data) {
        const { type, job } = json.data;
        if (type === 'scan') {
          await this.runScan(job.id);
        } else if (type === 'update') {
          await this.handleUpdate(job);
        }
      }
    } catch {
      // Poll error ignored
    }
  }
}
