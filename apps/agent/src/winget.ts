import { spawn } from 'child_process';
import { DetectedAppSchema } from '@updatepilot/shared';
import { z } from 'zod';

export type DetectedApp = z.infer<typeof DetectedAppSchema>;
type ReleaseDetails = Pick<DetectedApp, 'publisher' | 'homepageUrl' | 'changelogUrl' | 'releaseDate'>;

const packageIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const versionPattern = /^[A-Za-z0-9][A-Za-z0-9._+~-]{0,127}$/;

export function versionsMatch(v1?: string | null, v2?: string | null): boolean {
  if (!v1 || !v2) return false;
  if (v1 === v2) return true;
  const clean1 = v1.replace(/^[<>=~^v\s]+/i, '').trim();
  const clean2 = v2.replace(/^[<>=~^v\s]+/i, '').trim();
  if (clean1 === clean2) return true;
  const parts1 = clean1.split('.');
  const parts2 = clean2.split('.');
  const maxLen = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < maxLen; i++) {
    const p1 = parseInt(parts1[i] || '0', 10);
    const p2 = parseInt(parts2[i] || '0', 10);
    if (isNaN(p1) || isNaN(p2)) {
      if ((parts1[i] || '') !== (parts2[i] || '')) return false;
    } else if (p1 !== p2) {
      return false;
    }
  }
  return true;
}

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

function runProcess(
  cmd: string,
  args: string[],
  timeout = 120_000,
  onData?: (data: string) => void
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { windowsHide: true, timeout });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      if (onData) onData(text);
    });

    child.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      if (onData) onData(text);
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
  static async executeUpdate(
    packageId: string,
    fromVersion: string,
    targetVersion: string,
    onProgress?: (progress: { phase: string; percent: number; message: string }) => void
  ): Promise<{
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

    onProgress?.({ phase: 'verifying', percent: 5, message: 'Verifying installed version...' });

    const currentVersion = await this.verifyInstalledVersion(packageId, fromVersion);
    if (!currentVersion || !versionsMatch(currentVersion, fromVersion)) {
      throw new Error('The installed version changed or could not be verified. Scan again before approving an update.');
    }

    console.log(`[WingetService] Executing safe update for package: ${packageId}`);
    onProgress?.({ phase: 'downloading', percent: 15, message: 'Starting package download...' });

    let currentPhase = 'downloading';
    let currentPercent = 15;

    // Progress timer to smoothly advance download or installation while child runs
    const progressTimer = setInterval(() => {
      if (currentPhase === 'downloading') {
        if (currentPercent < 75) {
          currentPercent = Math.min(75, currentPercent + 3);
          onProgress?.({ phase: 'downloading', percent: currentPercent, message: 'Downloading installer package...' });
        }
      } else if (currentPhase === 'installing') {
        if (currentPercent < 92) {
          currentPercent = Math.min(92, currentPercent + 2);
          onProgress?.({ phase: 'installing', percent: currentPercent, message: 'Installing application files...' });
        }
      }
    }, 2000);

    const handleStdout = (chunk: string) => {
      const pctMatch = chunk.match(/(\d{1,3})\s*%/);
      if (pctMatch && currentPhase === 'downloading') {
        const val = parseInt(pctMatch[1], 10);
        if (!isNaN(val) && val >= 0 && val <= 100) {
          currentPercent = Math.max(currentPercent, Math.min(75, 15 + Math.round(val * 0.6)));
          onProgress?.({ phase: 'downloading', percent: currentPercent, message: `Downloading package (${val}%)...` });
          return;
        }
      }

      const mbMatch = chunk.match(/([\d.]+)\s*(MB|GB|KB)\s*\/\s*([\d.]+)\s*(MB|GB|KB)/i);
      if (mbMatch && currentPhase === 'downloading') {
        onProgress?.({ phase: 'downloading', percent: currentPercent, message: `Downloading package: ${mbMatch[0]}...` });
        return;
      }

      if (/Successfully verified installer hash|hash verified/i.test(chunk)) {
        currentPhase = 'installing';
        currentPercent = 78;
        onProgress?.({ phase: 'installing', percent: 78, message: 'Installer verified. Running installation...' });
        return;
      }

      if (/Starting package install|installing/i.test(chunk)) {
        currentPhase = 'installing';
        currentPercent = Math.max(currentPercent, 82);
        onProgress?.({ phase: 'installing', percent: currentPercent, message: 'Installing application...' });
        return;
      }

      if (/Successfully installed/i.test(chunk)) {
        currentPhase = 'verifying';
        currentPercent = 94;
        onProgress?.({ phase: 'verifying', percent: 94, message: 'Installation complete. Verifying...' });
        return;
      }
    };

    let result;
    try {
      result = await runProcess('winget', [
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
      ], 15 * 60_000, handleStdout);
    } finally {
      clearInterval(progressTimer);
    }

    onProgress?.({ phase: 'verifying', percent: 96, message: 'Verifying installed version...' });

    const logs = `--- EXECUTION LOGS ---\nExit Code: ${result.code}\n\nSTDOUT:\n${result.stdout}\n\nSTDERR:\n${result.stderr}`;

    // Common Windows Installer reboot-required exit codes:
    // 3010: ERROR_SUCCESS_REBOOT_REQUIRED
    // 1641: ERROR_SUCCESS_REBOOT_INITIATED
    // -1978335189 / -1978335188: WinGet specific reboot codes
    const rebootCodes = [3010, 1641, -1978335189, -1978335188];
    const restartRequired = rebootCodes.includes(result.code);

    // Post-update verification
    const verifiedCandidate = await this.verifyInstalledVersion(packageId, targetVersion);
    const versionMatchesTarget = verifiedCandidate !== null && versionsMatch(verifiedCandidate, targetVersion);
    const verifiedVersion = versionMatchesTarget ? targetVersion : verifiedCandidate;
    const verificationPassed = (result.code === 0 && versionMatchesTarget) ||
      (restartRequired && (versionMatchesTarget || result.code === 3010 || result.code === 1641));

    onProgress?.({
      phase: verificationPassed ? 'completed' : 'failed',
      percent: 100,
      message: verificationPassed ? 'Update installed and verified!' : 'Verification failed or version mismatch',
    });

    return {
      exitCode: result.code,
      outputLogs: logs,
      verifiedVersion,
      verificationPassed,
      restartRequired,
    };
  }

  /**
   * Verifies the installed version of a package after an upgrade operation or before execution.
   */
  static async verifyInstalledVersion(packageId: string, expectedVersion?: string): Promise<string | null> {
    try {
      let { stdout, code } = await runProcess('winget', [
        'list',
        '--id',
        packageId,
        '--exact',
        '--source',
        'winget',
        '--accept-source-agreements',
      ]);

      if (code !== 0 || !stdout.includes('---')) {
        const fallback = await runProcess('winget', [
          'list',
          '--id',
          packageId,
          '--exact',
          '--accept-source-agreements',
        ]);
        if (fallback.code === 0 && fallback.stdout.includes('---')) {
          stdout = fallback.stdout;
          code = fallback.code;
        }
      }

      if (code !== 0) return null;

      const lines = stdout.split(/\r?\n/);
      const sepIdx = lines.findIndex((l) => l.startsWith('---'));
      if (sepIdx === -1) return null;

      const header = lines[sepIdx - 1] || '';
      let idIdx = header.indexOf('Id');
      let verIdx = header.indexOf('Version');
      let availIdx = header.indexOf('Available');
      let sourceIdx = header.indexOf('Source');

      // Multi-locale fallback: derive column boundaries from dash segments
      if (idIdx < 0 || verIdx <= idIdx) {
        const sepLine = lines[sepIdx];
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

      if (idIdx < 0 || verIdx <= idIdx) return null;

      const versionsFound: string[] = [];
      for (let i = sepIdx + 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;
        const lineId = line.slice(idIdx, verIdx).trim();
        if (lineId.toLowerCase() === packageId.toLowerCase()) {
          const end = availIdx > verIdx ? availIdx : sourceIdx > verIdx ? sourceIdx : undefined;
          const version = line.substring(verIdx, end).trim();
          if (version) {
            versionsFound.push(version);
          }
        }
      }

      if (versionsFound.length === 0) return null;

      if (expectedVersion) {
        const matched = versionsFound.find(v => versionsMatch(v, expectedVersion));
        if (matched) return expectedVersion;
      }

      return versionsFound[0];
    } catch {
      // verification error
    }
    return null;
  }
}
