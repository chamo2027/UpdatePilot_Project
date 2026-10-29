import { spawn } from 'child_process';
import { DetectedAppSchema } from '@updatepilot/shared';
import { z } from 'zod';

export type DetectedApp = z.infer<typeof DetectedAppSchema>;

function runProcess(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { shell: true });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({ stdout, stderr, code: code ?? 0 });
    });

    child.on('error', (err) => {
      resolve({ stdout, stderr: err.message, code: 1 });
    });
  });
}

export class WingetService {
  /**
   * Discovers all installed applications via winget and parses table columns safely.
   */
  static async listInstalledApplications(): Promise<DetectedApp[]> {
    const { stdout, code } = await runProcess('winget', [
      'list',
      '--accept-source-agreements',
    ]);

    if (code !== 0 && !stdout) {
      throw new Error(`Failed to execute winget list. Process exited with code ${code}`);
    }

    const lines = stdout.split(/\r?\n/);
    const headerSeparatorIndex = lines.findIndex((l) => l.startsWith('---'));

    if (headerSeparatorIndex === -1 || headerSeparatorIndex === 0) {
      return [];
    }

    const headerLine = lines[headerSeparatorIndex - 1];
    const separatorLine = lines[headerSeparatorIndex];

    // Calculate column boundaries from header names
    const idIdx = headerLine.indexOf('Id');
    const verIdx = headerLine.indexOf('Version');
    const availIdx = headerLine.indexOf('Available');
    const sourceIdx = headerLine.indexOf('Source');

    const apps: DetectedApp[] = [];

    for (let i = headerSeparatorIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line || line.trim() === '' || line.startsWith('<') || line.startsWith('The `msstore`')) {
        continue;
      }

      // Check if line is long enough to have columns
      if (line.length < idIdx) continue;

      const name = line.substring(0, idIdx).trim();
      const id = line.substring(idIdx, verIdx !== -1 ? verIdx : undefined).trim();
      const version = verIdx !== -1 ? line.substring(verIdx, availIdx !== -1 ? availIdx : undefined).trim() : 'Unknown';
      const available = availIdx !== -1 ? line.substring(availIdx, sourceIdx !== -1 ? sourceIdx : undefined).trim() : '';
      const sourceRaw = sourceIdx !== -1 && line.length > sourceIdx ? line.substring(sourceIdx).trim() : '';

      if (!name) continue;

      const isArp = id.startsWith('ARP\\') || id.startsWith('{');
      const source = isArp ? 'registry' : (sourceRaw || (id.includes('.') ? 'winget' : 'other'));
      
      let updateStatus: 'up_to_date' | 'update_available' | 'unknown' | 'unsupported' = 'up_to_date';
      let availableVersion: string | null = null;

      if (available && available.length > 0 && available !== '<' && !available.startsWith('---')) {
        updateStatus = 'update_available';
        availableVersion = available;
      } else if (version === 'Unknown' || version === '') {
        updateStatus = 'unknown';
      } else if (isArp) {
        updateStatus = 'unsupported'; // Unmanaged raw registry item
      }

      apps.push({
        displayName: name,
        packageId: isArp ? null : id,
        installedVersion: version || '1.0.0',
        availableVersion: availableVersion,
        source,
        updateStatus,
        publisher: guessPublisher(id, name),
        changelogUrl: availableVersion && id ? `https://github.com/microsoft/winget-pkgs/tree/master/manifests/${id.slice(0, 1).toLowerCase()}/${id.replace(/\./g, '/')}` : null,
        homepageUrl: id.includes('.') ? `https://winget.run/pkg/${id}` : null,
      });
    }

    return apps;
  }

  /**
   * Executes a safe, allowlisted update command for an approved package ID.
   */
  static async executeUpdate(packageId: string): Promise<{
    exitCode: number;
    outputLogs: string;
    verifiedVersion: string | null;
    verificationPassed: boolean;
  }> {
    // Input validation: ensure packageId conforms to safe pattern
    if (!/^[a-zA-Z0-9_\-\.]+$/.test(packageId)) {
      throw new Error(`Invalid package identifier: ${packageId}`);
    }

    console.log(`[WingetService] Executing safe update for package: ${packageId}`);

    const result = await runProcess('winget', [
      'upgrade',
      '--id',
      packageId,
      '--exact',
      '--accept-package-agreements',
      '--accept-source-agreements',
      '--disable-interactivity',
    ]);

    const logs = `--- EXECUTION LOGS ---\nExit Code: ${result.code}\n\nSTDOUT:\n${result.stdout}\n\nSTDERR:\n${result.stderr}`;

    // Post-update verification
    const verifiedVersion = await this.verifyInstalledVersion(packageId);
    const verificationPassed = result.code === 0 && verifiedVersion !== null;

    return {
      exitCode: result.code,
      outputLogs: logs,
      verifiedVersion,
      verificationPassed,
    };
  }

  /**
   * Verifies the installed version of a package after an upgrade operation.
   */
  static async verifyInstalledVersion(packageId: string): Promise<string | null> {
    try {
      const { stdout } = await runProcess('winget', [
        'list',
        '--id',
        packageId,
        '--exact',
        '--accept-source-agreements',
      ]);

      const lines = stdout.split(/\r?\n/);
      const sepIdx = lines.findIndex((l) => l.startsWith('---'));
      if (sepIdx !== -1 && lines[sepIdx + 1]) {
        const line = lines[sepIdx + 1];
        const header = lines[sepIdx - 1];
        const verIdx = header.indexOf('Version');
        const availIdx = header.indexOf('Available');
        if (verIdx !== -1) {
          const version = line.substring(verIdx, availIdx !== -1 ? availIdx : undefined).trim();
          return version || null;
        }
      }
    } catch {
      // verification error
    }
    return null;
  }
}

function guessPublisher(packageId: string, displayName: string): string | null {
  if (packageId.includes('.')) {
    return packageId.split('.')[0];
  }
  if (displayName.includes('Microsoft')) return 'Microsoft Corporation';
  if (displayName.includes('Google')) return 'Google LLC';
  if (displayName.includes('Intel')) return 'Intel Corporation';
  if (displayName.includes('Docker')) return 'Docker Inc.';
  if (displayName.includes('Git')) return 'Software Freedom Conservancy';
  return null;
}
