import { spawn } from 'child_process';
import { DetectedAppSchema } from '@updatepilot/shared';
import { z } from 'zod';

export type DetectedApp = z.infer<typeof DetectedAppSchema>;
type ReleaseDetails = Pick<DetectedApp, 'publisher' | 'homepageUrl' | 'changelogUrl' | 'releaseDate'>;

const packageIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const versionPattern = /^[A-Za-z0-9][A-Za-z0-9._+~-]{0,127}$/;

function parseHttps(value?: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

export function parseReleaseDetails(stdout: string): ReleaseDetails {
  const field = (name: string) => stdout.split(/\r?\n/)
    .map(line => line.trim()).find(line => line.startsWith(name + ':'))?.slice(name.length + 1).trim();
  const date = field('Release Date');
  return {
    publisher: field('Publisher') || null,
    homepageUrl: parseHttps(field('Homepage')) || parseHttps(field('Publisher Url')),
    changelogUrl: parseHttps(field('Release Notes Url')),
    releaseDate: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
  };
}

function runProcess(cmd: string, args: string[], timeout = 120_000): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { windowsHide: true, timeout });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({ stdout, stderr: code === null ? stderr + '\nWinGet stopped before completion.' : stderr, code: code ?? 1 });
    });

    child.on('error', (err) => {
      resolve({ stdout, stderr: err.message, code: 1 });
    });
  });
}

export class WingetService {
  private static releaseCache = new Map<string, { expires: number; details: ReleaseDetails }>();

  private static async getReleaseDetails(packageId: string, version: string): Promise<ReleaseDetails | null> {
    const key = packageId + ':' + version;
    const cached = this.releaseCache.get(key);
    if (cached && cached.expires > Date.now()) return cached.details;
    const { stdout, code } = await runProcess('winget', [
      'show', '--id', packageId, '--exact', '--version', version, '--source', 'winget',
      '--disable-interactivity', '--accept-source-agreements',
    ], 8_000);
    if (code !== 0) return null;
    const details = parseReleaseDetails(stdout);
    if (this.releaseCache.size >= 128) this.releaseCache.clear();
    this.releaseCache.set(key, { expires: Date.now() + 60 * 60_000, details });
    return details;
  }

  /**
   * Discovers all installed applications via winget and parses table columns safely.
   */
  static async listInstalledApplications(): Promise<DetectedApp[]> {
    const { stdout, code } = await runProcess('winget', [
      'list',
      '--accept-source-agreements',
    ]);

    if (code !== 0) {
      throw new Error(`Failed to execute winget list. Process exited with code ${code}`);
    }

    const lines = stdout.split(/\r?\n/);
    const headerSeparatorIndex = lines.findIndex((l) => l.startsWith('---'));

    if (headerSeparatorIndex === -1 || headerSeparatorIndex === 0) {
      throw new Error('WinGet inventory format was not recognized.');
    }

    const headerLine = lines[headerSeparatorIndex - 1];

    // Calculate column boundaries from header names or dash separator groups
    let idIdx = headerLine.indexOf('Id');
    let verIdx = headerLine.indexOf('Version');
    let availIdx = headerLine.indexOf('Available');
    let sourceIdx = headerLine.indexOf('Source');

    // Multi-locale fallback: derive column boundaries from dash segments
    if (idIdx < 0 || verIdx <= idIdx) {
      const sepLine = lines[headerSeparatorIndex];
      const segments: { start: number; end: number }[] = [];
      const regex = /-+|\S+/g;
      let match;
      while ((match = regex.exec(sepLine)) !== null) {
        segments.push({ start: match.index, end: match.index + match[0].length });
      }
      if (segments.length >= 3) {
        idIdx = segments[1].start;
        verIdx = segments[2].start;
        availIdx = segments.length >= 4 ? segments[3].start : -1;
        sourceIdx = segments.length >= 5 ? segments[4].start : -1;
      }
    }

    if (idIdx < 0 || verIdx <= idIdx) throw new Error('WinGet inventory columns were not recognized.');

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
      const version = line.substring(verIdx, availIdx > verIdx ? availIdx : sourceIdx > verIdx ? sourceIdx : undefined).trim();
      const available = availIdx !== -1 ? line.substring(availIdx, sourceIdx !== -1 ? sourceIdx : undefined).trim() : '';
      const sourceRaw = sourceIdx !== -1 && line.length > sourceIdx ? line.substring(sourceIdx).trim() : '';

      if (!name) continue;

      const isArp = id.startsWith('ARP\\') || id.startsWith('{');
      const source = isArp ? 'registry' : (sourceRaw || 'other');
      const isMatched = source === 'winget' && packageIdPattern.test(id);
      
      let updateStatus: 'up_to_date' | 'update_available' | 'unknown' | 'unsupported' = 'up_to_date';
      let availableVersion: string | null = null;

      if (!isMatched) {
        updateStatus = 'unsupported';
      } else if (!version || /^unknown$/i.test(version)) {
        updateStatus = 'unknown';
      } else if (versionPattern.test(available) && available !== version) {
        updateStatus = 'update_available';
        availableVersion = available;
      }

      apps.push({
        displayName: name,
        packageId: isArp ? null : id,
        installedVersion: version || 'Unknown',
        availableVersion: availableVersion,
        source,
        updateStatus,
        publisher: null,
        changelogUrl: null,
        homepageUrl: null,
      });
    }

    const enrichable = apps.filter(app => app.packageId && app.availableVersion).slice(0, 12);
    for (let index = 0; index < enrichable.length; index += 3) {
      await Promise.all(enrichable.slice(index, index + 3).map(async app => {
        const details = await this.getReleaseDetails(app.packageId!, app.availableVersion!);
        if (details) Object.assign(app, details);
      }));
    }
    return apps;
  }

  /**
   * Executes a safe, allowlisted update command for an approved package ID.
   */
  static async executeUpdate(packageId: string, fromVersion: string, targetVersion: string): Promise<{
    exitCode: number;
    outputLogs: string;
    verifiedVersion: string | null;
    verificationPassed: boolean;
    restartRequired?: boolean;
  }> {
    // Input validation: ensure packageId conforms to safe pattern
    if (!packageIdPattern.test(packageId) || !versionPattern.test(targetVersion)) {
      throw new Error('Invalid approved package identifier or target version.');
    }

    if (await this.verifyInstalledVersion(packageId) !== fromVersion) {
      throw new Error('The installed version changed or could not be verified. Scan again before approving an update.');
    }

    console.log(`[WingetService] Executing safe update for package: ${packageId}`);

    const result = await runProcess('winget', [
      'upgrade',
      '--id',
      packageId,
      '--exact',
      '--source',
      'winget',
      '--version',
      targetVersion,
      '--accept-package-agreements',
      '--accept-source-agreements',
      '--disable-interactivity',
    ], 15 * 60_000);

    const logs = `--- EXECUTION LOGS ---\nExit Code: ${result.code}\n\nSTDOUT:\n${result.stdout}\n\nSTDERR:\n${result.stderr}`;

    // Common Windows Installer reboot-required exit codes:
    // 3010: ERROR_SUCCESS_REBOOT_REQUIRED
    // 1641: ERROR_SUCCESS_REBOOT_INITIATED
    // -1978335189 / -1978335188: WinGet specific reboot codes
    const rebootCodes = [3010, 1641, -1978335189, -1978335188];
    const restartRequired = rebootCodes.includes(result.code);

    // Post-update verification
    const verifiedVersion = await this.verifyInstalledVersion(packageId);
    const verificationPassed = (result.code === 0 && verifiedVersion === targetVersion) ||
      (restartRequired && (verifiedVersion === targetVersion || result.code === 3010 || result.code === 1641));

    return {
      exitCode: result.code,
      outputLogs: logs,
      verifiedVersion,
      verificationPassed,
      restartRequired,
    };
  }

  /**
   * Verifies the installed version of a package after an upgrade operation.
   */
  static async verifyInstalledVersion(packageId: string): Promise<string | null> {
    try {
      const { stdout, code } = await runProcess('winget', [
        'list',
        '--id',
        packageId,
        '--exact',
        '--source',
        'winget',
        '--accept-source-agreements',
      ]);
      if (code !== 0) return null;

      const lines = stdout.split(/\r?\n/);
      const sepIdx = lines.findIndex((l) => l.startsWith('---'));
      if (sepIdx !== -1 && lines[sepIdx + 1]) {
        const line = lines[sepIdx + 1];
        const header = lines[sepIdx - 1];
        const idIdx = header.indexOf('Id');
        const verIdx = header.indexOf('Version');
        const availIdx = header.indexOf('Available');
        const sourceIdx = header.indexOf('Source');
        if (idIdx >= 0 && verIdx > idIdx && line.slice(idIdx, verIdx).trim().toLowerCase() === packageId.toLowerCase()) {
          const end = availIdx > verIdx ? availIdx : sourceIdx > verIdx ? sourceIdx : undefined;
          const version = line.substring(verIdx, end).trim();
          return version || null;
        }
      }
    } catch {
      // verification error
    }
    return null;
  }
}
