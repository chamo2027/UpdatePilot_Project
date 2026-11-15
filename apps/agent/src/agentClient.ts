import fs from 'fs';
import path from 'path';
import { getSystemInfo } from './systemInfo';
import { WingetService } from './winget';

const STATE_FILE = path.resolve('.agent_state.json');

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
          pairingCode: process.env.AGENT_PAIRING_CODE || undefined,
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
    if (!this.deviceId) return false;

    console.log('[Agent] Initiating live WinGet application inventory discovery...');
    let jobId = scanJobId;
    try {
      if (!jobId) {
        const createRes = await fetch(`${this.serverUrl}/agent/scans`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${this.token}` },
        });
        const createJson: any = await createRes.json();
        jobId = createJson?.data?.id;
      }

      if (!jobId) {
        throw new Error('Failed to obtain a ScanJob ID from server');
      }

      const apps = await WingetService.listInstalledApplications();
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
        return true;
      } else {
        console.error('[Agent] Failed to report scan results:', reportJson);
      }
    } catch (err: any) {
      console.error('[Agent] Scan failed:', err.message);
      if (jobId) {
        await fetch(`${this.serverUrl}/agent/scans/report`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
          body: JSON.stringify({ deviceId: this.deviceId, scanJobId: jobId, applications: [], error: err.message }),
        }).catch(() => undefined);
      }
    }
    return false;
  }

  async handleUpdate(job: any) {
    console.log(`[Agent] Received approved update job for ${job.applicationName} (${job.packageId})`);
    try {
      const result = await WingetService.executeUpdate(job.packageId, job.fromVersion, job.targetVersion);

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
          restartRequired: result.restartRequired,
        }),
      });

      console.log(`[Agent] Update finished for ${job.applicationName}. Verified: ${result.verificationPassed}`);
    } catch (err: any) {
      console.error(`[Agent] Update execution failed: ${err.message}`);
      await fetch(`${this.serverUrl}/agent/updates/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
        },
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
