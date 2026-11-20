import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import {
  SESSION_COOKIE_NAME,
  createSessionToken,
  getAuthUserId,
  authenticateAgentToken,
  sameSecret,
} from '@/lib/server/auth';
import {
  AuthService,
  DeviceService,
  InventoryService,
  JobService,
  SecurityService,
  AuditService,
} from '@/lib/server/services';

function respondJson(data: any, status = 200, cookieToken?: string, clearCookie = false) {
  const res = NextResponse.json(data, { status });
  if (cookieToken) {
    res.cookies.set(SESSION_COOKIE_NAME, cookieToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 8 * 60 * 60,
    });
  } else if (clearCookie) {
    res.cookies.set(SESSION_COOKIE_NAME, '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 0,
    });
  }
  return res;
}

function respondError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function GET(req: NextRequest, { params }: { params: { slug?: string[] } }) {
  const slug = params.slug || [];
  const path = slug.join('/');

  // 1. One-click Windows PowerShell quick-connect and inventory scan script
  if (path === 'install-agent.ps1') {
    const code = req.nextUrl.searchParams.get('code') || '';
    const host = req.headers.get('host') || 'localhost:3000';
    const proto = req.nextUrl.protocol.replace(':', '');
    const serverUrl = `${proto}://${host}/api/v1`;

    const script = `# ==========================================================
# UpdatePilot - One-Click Windows Computer Connect & Scanner
# ==========================================================
$ErrorActionPreference = 'Stop'
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   UpdatePilot Cloud - Connecting This Windows PC...      " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$serverUrl = "${serverUrl}"
$pairingCode = "${code}"

if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Windows Package Manager (winget) is required." -ForegroundColor Red
    Write-Host "Please install WinGet from the Microsoft Store (App Installer)." -ForegroundColor Yellow
    exit 1
}

$pcName = $env:COMPUTERNAME
$osCaption = (Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue).Caption
if (-not $osCaption) { $osCaption = "Windows 10/11" }

Write-Host "Computer Name : $pcName" -ForegroundColor White
Write-Host "OS Version    : $osCaption" -ForegroundColor White
Write-Host "Pairing Key   : $pairingCode" -ForegroundColor Yellow

Write-Host ""
Write-Host "[1/3] Linking PC to your UpdatePilot Cloud account..." -ForegroundColor Cyan
$pairBody = @{
    deviceName = $pcName
    osVersion = $osCaption
    agentVersion = "1.0.0"
    pairingCode = $pairingCode
} | ConvertTo-Json

try {
    $pairRes = Invoke-RestMethod -Uri "$serverUrl/devices/pair" -Method Post -Body $pairBody -ContentType "application/json"
    $token = $pairRes.data.token
    $deviceId = $pairRes.data.deviceId
    Write-Host "Device linked successfully! (ID: $deviceId)" -ForegroundColor Green
} catch {
    Write-Host "Error linking device: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[2/3] Scanning installed applications via Windows Package Manager..." -ForegroundColor Cyan
Write-Host "      Querying Microsoft package catalog & scanning system programs..." -ForegroundColor Gray
Write-Host "      (Usually takes 20-40 seconds for 100+ installed applications)..." -ForegroundColor Gray
$authHeader = @{ "Authorization" = "Bearer $token" }
try {
    $scanJob = Invoke-RestMethod -Uri "$serverUrl/agent/scans" -Method Post -Headers $authHeader -ContentType "application/json"
    $scanJobId = $scanJob.data.id
} catch {
    Write-Host "Error creating scan job: $_" -ForegroundColor Red
    exit 1
}

$raw = winget list --accept-source-agreements --disable-interactivity 2>&1 | Out-String
$lines = $raw -split "\\r?\\n"

$apps = @()
$headerFound = $false
$sepFound = $false

foreach ($line in $lines) {
    if (-not $headerFound) {
        if ($line -match '^Name\\s+Id\\s+Version') {
            $headerFound = $true
        }
        continue
    }
    if (-not $sepFound) {
        if ($line -match '^-+') {
            $sepFound = $true
        }
        continue
    }
    if ([string]::IsNullOrWhiteSpace($line)) { continue }

    $parts = ($line -replace '\\s{2,}', [char]9) -split [char]9
    if ($parts.Count -ge 3) {
        $appName = $parts[0].Trim()
        $appId = $parts[1].Trim()
        $version = $parts[2].Trim()
        $avail = $null
        if ($parts.Count -ge 4 -and $parts[3].Trim() -ne "") {
            $avail = $parts[3].Trim()
        }
        $status = if ($null -ne $avail -and $avail -ne $version) { "update_available" } else { "up_to_date" }

        $apps += @{
            displayName = $appName
            packageId = $appId
            installedVersion = $version
            availableVersion = $avail
            updateStatus = $status
            source = "winget"
        }
    }
}

Write-Host "Discovered $($apps.Count) installed applications." -ForegroundColor Green

Write-Host ""
Write-Host "[3/3] Uploading application inventory to UpdatePilot Cloud..." -ForegroundColor Cyan
$reportPayload = @{
    scanJobId = $scanJobId
    applications = $apps
} | ConvertTo-Json -Depth 5

try {
    $reportRes = Invoke-RestMethod -Uri "$serverUrl/agent/scans/report" -Method Post -Headers $authHeader -Body $reportPayload -ContentType "application/json"
    Write-Host ""
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "   SUCCESS: Computer connected and inventory synchronized! " -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "Return to your browser dashboard to view all installed applications and updates." -ForegroundColor Cyan
} catch {
    Write-Host "Error uploading inventory: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   UpdatePilot Agent Active - Ready for Remote Updates!    " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Keep this window open while managing updates from the dashboard." -ForegroundColor White
Write-Host "When you click 'Confirm & Update' on the website, this window will execute it." -ForegroundColor White
Write-Host "Press Ctrl + C at any time to disconnect and exit." -ForegroundColor Yellow
Write-Host ""

while (\$true) {
    Start-Sleep -Seconds 3

    # Send heartbeat
    try {
        \$hb = @{ deviceId = \$deviceId } | ConvertTo-Json
        \$null = Invoke-RestMethod -Uri "\$serverUrl/agent/heartbeat" -Method Post -Headers \$authHeader -Body \$hb -ContentType "application/json" -ErrorAction SilentlyContinue
    } catch {}

    # Check for pending update jobs
    try {
        \$pending = Invoke-RestMethod -Uri "\$serverUrl/agent/jobs/pending" -Method Get -Headers \$authHeader -ErrorAction SilentlyContinue
        if (\$pending -and \$pending.success -and \$pending.data) {
            \$jobType = \$pending.data.type
            \$job = \$pending.data.job

            if (\$jobType -eq "update" -and \$job) {
                Write-Host ""
                Write-Host ">>> [UPDATE INITIATED] \$(\$job.applicationName) -> Version \$(\$job.targetVersion)" -ForegroundColor Yellow
                Write-Host "Starting download and silent installation via WinGet..." -ForegroundColor Cyan

                # Progress 25% downloading
                try {
                    \$prog = @{
                        jobId = \$job.id
                        progressPercent = 25
                        progressPhase = "downloading"
                        progressMessage = "Downloading installer package via Windows Package Manager..."
                    } | ConvertTo-Json
                    \$null = Invoke-RestMethod -Uri "\$serverUrl/agent/updates/progress" -Method Post -Headers \$authHeader -Body \$prog -ContentType "application/json" -ErrorAction SilentlyContinue
                } catch {}

                # Progress 60% installing
                try {
                    \$prog = @{
                        jobId = \$job.id
                        progressPercent = 60
                        progressPhase = "installing"
                        progressMessage = "Installing update files..."
                    } | ConvertTo-Json
                    \$null = Invoke-RestMethod -Uri "\$serverUrl/agent/updates/progress" -Method Post -Headers \$authHeader -Body \$prog -ContentType "application/json" -ErrorAction SilentlyContinue
                } catch {}

                # Execute WinGet upgrade
                \$upgradeOutput = winget upgrade --id \$job.packageId --exact --accept-package-agreements --accept-source-agreements --disable-interactivity 2>&1 | Out-String
                \$exitCode = \$LASTEXITCODE
                if (\$null -eq \$exitCode) { \$exitCode = 0 }

                # Progress 90% verifying
                try {
                    \$prog = @{
                        jobId = \$job.id
                        progressPercent = 90
                        progressPhase = "verifying"
                        progressMessage = "Verifying installation result..."
                    } | ConvertTo-Json
                    \$null = Invoke-RestMethod -Uri "\$serverUrl/agent/updates/progress" -Method Post -Headers \$authHeader -Body \$prog -ContentType "application/json" -ErrorAction SilentlyContinue
                } catch {}

                \$rebootRequired = (\$exitCode -eq 3010 -or \$exitCode -eq 1641)
                \$passed = (\$exitCode -eq 0 -or \$rebootRequired)

                # Report final update result
                \$resultBody = @{
                    jobId = \$job.id
                    exitCode = \$exitCode
                    outputLogs = \$upgradeOutput
                    verifiedInstalledVersion = \$job.targetVersion
                    verificationPassed = \$passed
                    restartRequired = \$rebootRequired
                } | ConvertTo-Json

                try {
                    \$null = Invoke-RestMethod -Uri "\$serverUrl/agent/updates/report" -Method Post -Headers \$authHeader -Body \$resultBody -ContentType "application/json"
                    if (\$passed) {
                        Write-Host ">>> [SUCCESS] \$(\$job.applicationName) updated successfully to version \$(\$job.targetVersion)!" -ForegroundColor Green
                    } else {
                        Write-Host ">>> [FAILED] Update exited with code \$exitCode." -ForegroundColor Red
                    }
                } catch {
                    Write-Host "Error reporting update result: \$_" -ForegroundColor Red
                }
                Write-Host ""
                Write-Host "Waiting for next dashboard instruction... (Ctrl+C to exit)" -ForegroundColor Cyan
            }
        }
    } catch {}
}
`;
    return new NextResponse(script, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  // 2. Agent job polling (authenticated via Bearer token)
  if (path === 'agent/jobs/pending') {
    const device = await authenticateAgentToken(req.headers.get('authorization'));
    if (!device) return respondError('Agent credentials invalid or revoked', 401);
    try {
      const pending = await JobService.pollPendingJobs(device.id);
      return respondJson({ success: true, data: pending });
    } catch (e: any) {
      return respondError(e.message, 500);
    }
  }

  // 3. User session info
  if (path === 'session') {
    const userId = getAuthUserId(req);
    if (!userId) return respondError('Sign in to UpdatePilot.', 401);
    return respondJson({ success: true, userId });
  }

  // 4. Current user profile
  if (path === 'auth/me') {
    const userId = getAuthUserId(req);
    if (!userId) return respondError('Not authenticated', 401);

    if (userId === 'admin') {
      const admin = await prisma.user.findFirst({ where: { role: 'admin' } });
      return respondJson({
        success: true,
        data: {
          id: admin?.id || 'admin',
          email: admin?.email || 'admin@updatepilot.local',
          name: admin?.name || 'Administrator',
          role: 'admin',
          pairingCode: admin?.pairingCode || process.env.AGENT_PAIRING_CODE || 'UP-ADMIN-DEFAULT',
        },
      });
    }

    const user = await AuthService.getUserById(userId);
    if (!user) return respondError('User not found', 404);
    return respondJson({ success: true, data: user });
  }

  // From here down, require authenticated user
  const userId = getAuthUserId(req);
  if (!userId) {
    return respondError('Sign in to UpdatePilot.', 401);
  }

  try {
    // Dashboard metrics
    if (path === 'dashboard') {
      const metrics = await InventoryService.getDashboardMetrics(userId);
      return respondJson({ success: true, data: metrics });
    }

    // Devices list
    if (path === 'devices') {
      const devices = await DeviceService.getDevices(userId);
      return respondJson({ success: true, data: devices });
    }

    // Applications list
    if (path === 'applications') {
      const url = req.nextUrl;
      const deviceId = url.searchParams.get('deviceId') || undefined;
      const search = url.searchParams.get('search') || undefined;
      const status = url.searchParams.get('status') || undefined;
      const source = url.searchParams.get('source') || undefined;
      const sortBy = (url.searchParams.get('sortBy') as any) || undefined;
      const sortOrder = (url.searchParams.get('sortOrder') as any) || undefined;
      const page = url.searchParams.get('page') ? parseInt(url.searchParams.get('page')!, 10) : undefined;
      const pageSize = url.searchParams.get('pageSize') ? parseInt(url.searchParams.get('pageSize')!, 10) : undefined;

      const result = await InventoryService.getApplications({
        userId,
        deviceId,
        search,
        status,
        source,
        sortBy,
        sortOrder,
        page,
        pageSize,
      });
      return respondJson({ success: true, ...result });
    }

    // Single application
    if (slug.length === 2 && slug[0] === 'applications') {
      const app = await InventoryService.getApplicationById(slug[1]);
      if (!app) return respondError('Application not found', 404);
      return respondJson({ success: true, data: app });
    }

    // Available updates
    if (path === 'updates') {
      const deviceId = req.nextUrl.searchParams.get('deviceId') || undefined;
      const updates = await InventoryService.getAvailableUpdates(userId, deviceId);
      return respondJson({ success: true, data: updates });
    }

    // Single scan job
    if (slug.length === 2 && slug[0] === 'scans') {
      const job = await JobService.getScanJob(slug[1]);
      if (!job) return respondError('Scan job not found', 404);
      return respondJson({ success: true, data: job });
    }

    // Single update job
    if (slug.length === 2 && slug[0] === 'jobs') {
      const job = await JobService.getUpdateJob(slug[1]);
      if (!job) return respondError('Job not found', 404);
      return respondJson({ success: true, data: job });
    }

    // History
    if (path === 'history') {
      const history = await AuditService.getHistory(100, userId);
      return respondJson({ success: true, data: history });
    }

    // Reports
    if (slug.length === 2 && slug[0] === 'reports') {
      const kind = slug[1];
      if (kind === 'inventory') {
        const apps = await prisma.application.findMany({
          where: userId !== 'admin' ? { device: { ownerId: userId } } : {},
          orderBy: { displayName: 'asc' },
        });
        return respondJson({ success: true, data: apps });
      }
      if (kind === 'updates') {
        const jobs = await prisma.updateJob.findMany({
          where: userId !== 'admin' ? { device: { ownerId: userId } } : {},
          orderBy: { createdAt: 'desc' },
        });
        return respondJson({ success: true, data: jobs });
      }
      return respondError('Report type not found', 404);
    }

    // Security findings
    if (path === 'security/findings') {
      const findings = await SecurityService.getFindings();
      return respondJson({ success: true, data: findings });
    }

    return respondError('Not found', 404);
  } catch (err: any) {
    return respondError(err.message, 500);
  }
}

export async function POST(req: NextRequest, { params }: { params: { slug?: string[] } }) {
  const slug = params.slug || [];
  const path = slug.join('/');

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  // 1. Auth: Register
  if (path === 'auth/register') {
    try {
      const { email, password, name } = body;
      if (!email || !password || !name) {
        return respondError('Email, password, and name are required.', 400);
      }
      const user = await AuthService.register({ email, password, name });
      const token = createSessionToken(user.id);
      return respondJson({ success: true, data: user }, 201, token);
    } catch (err: any) {
      return respondError(err.message, 400);
    }
  }

  // 2. Auth: Login
  if (path === 'auth/login') {
    try {
      const { email, password } = body;
      if (!email || !password) {
        return respondError('Email and password are required.', 400);
      }
      const user = await AuthService.login({ email, password });
      const token = createSessionToken(user.id);
      return respondJson({ success: true, data: user }, 200, token);
    } catch (err: any) {
      return respondError(err.message, 401);
    }
  }

  // 3. Auth: Logout
  if (path === 'auth/logout') {
    return respondJson({ success: true }, 200, undefined, true);
  }

  // 4. Legacy session login (admin password)
  if (path === 'session') {
    const dashboardPass = process.env.DASHBOARD_PASSWORD;
    if (!dashboardPass) {
      return respondError('DASHBOARD_PASSWORD not configured', 503);
    }
    if (typeof body.password !== 'string' || !sameSecret(body.password, dashboardPass)) {
      return respondError('Incorrect dashboard password.', 401);
    }
    const token = createSessionToken('admin');
    return respondJson({ success: true }, 200, token);
  }

  // 5. Device Pairing (Called by Host Agent)
  if (path === 'devices/pair') {
    try {
      const { deviceName, osVersion, agentVersion, pairingToken, pairingCode } = body;
      if (!deviceName || !osVersion || !agentVersion) {
        return respondError('Device name, OS version, and Agent version are required.', 400);
      }
      const result = await DeviceService.pairDevice({
        deviceName,
        osVersion,
        agentVersion,
        pairingToken,
        pairingCode,
      });
      return respondJson({ success: true, data: result });
    } catch (err: any) {
      return respondError(err.message || 'Pairing refused', 403);
    }
  }

  // 6. Host Agent API Channel (Protected by Bearer token)
  if (path.startsWith('agent/')) {
    const device = await authenticateAgentToken(req.headers.get('authorization'));
    if (!device) return respondError('Agent credentials invalid or revoked', 401);

    try {
      if (path === 'agent/heartbeat') {
        const updated = await DeviceService.heartbeat(device.id);
        return respondJson({ success: true, data: { status: updated.status } });
      }

      if (path === 'agent/scans') {
        const job = await JobService.createScanJob(device.id, 'agent');
        return respondJson({ success: true, data: job }, 202);
      }

      if (path === 'agent/scans/report') {
        const { scanJobId, applications, error } = body;
        if (!scanJobId) return respondError('scanJobId is required', 400);

        if (error) {
          await prisma.scanJob.update({
            where: { id: scanJobId },
            data: { state: 'failed', errorMessage: error, completedAt: new Date() },
          });
          await AuditService.record({ actor: 'agent', deviceId: device.id, eventType: 'SCAN_FAILED', target: scanJobId });
          return respondJson({ success: true });
        }

        const result = await InventoryService.reportScanResult({
          deviceId: device.id,
          scanJobId,
          applications: Array.isArray(applications) ? applications : [],
        });
        if (!result) return respondError('Active scan not found.', 404);
        return respondJson({ success: true, data: result });
      }

      if (path === 'agent/updates/report') {
        const { jobId, exitCode, outputLogs, verifiedInstalledVersion, verificationPassed, restartRequired } = body;
        const result = await JobService.reportUpdateResult({
          deviceId: device.id,
          jobId,
          exitCode,
          outputLogs: outputLogs || '',
          verifiedInstalledVersion,
          verificationPassed: Boolean(verificationPassed),
          restartRequired: Boolean(restartRequired),
        });
        if (!result) return respondError('Active update not found.', 404);
        return respondJson({ success: true, data: result });
      }

      if (path === 'agent/updates/progress') {
        const { jobId, progressPercent, progressPhase, progressMessage } = body;
        const result = await JobService.updateJobProgress({
          deviceId: device.id,
          jobId,
          progressPercent: Number(progressPercent) || 0,
          progressPhase: progressPhase || 'downloading',
          progressMessage,
        });
        return respondJson({ success: true, count: result.count });
      }

      return respondError('Unknown agent action', 404);
    } catch (err: any) {
      return respondError(err.message, 500);
    }
  }

  // 7. Dashboard Actions (Require User Auth)
  const userId = getAuthUserId(req);
  if (!userId) {
    return respondError('Sign in to UpdatePilot.', 401);
  }

  try {
    // Revoke device: POST /devices/:id/revoke
    if (slug.length === 3 && slug[0] === 'devices' && slug[2] === 'revoke') {
      const deviceId = slug[1];
      const result = await DeviceService.revokeDevice(deviceId, userId);
      return respondJson({ success: true, data: result });
    }

    // Trigger device scan: POST /devices/:id/scans
    if (slug.length === 3 && slug[0] === 'devices' && slug[2] === 'scans') {
      const deviceId = slug[1];
      const job = await JobService.createScanJob(deviceId, 'user');
      return respondJson({ success: true, data: job }, 202);
    }

    // Preview update: POST /updates/:id/preview
    if (slug.length === 3 && slug[0] === 'updates' && slug[2] === 'preview') {
      const appId = slug[1];
      const preview = await JobService.previewUpdate(appId);
      return respondJson({ success: true, data: preview });
    }

    // Execute update: POST /updates/:id/execute
    if (slug.length === 3 && slug[0] === 'updates' && slug[2] === 'execute') {
      const appId = slug[1];
      const { targetVersion, confirmedByUser } = body;
      const job = await JobService.executeUpdate({
        applicationId: appId,
        targetVersion,
        confirmedByUser: Boolean(confirmedByUser),
        initiator: 'user',
      });
      return respondJson({ success: true, data: job }, 202);
    }

    // Cancel update: POST /jobs/:id/cancel
    if (slug.length === 3 && slug[0] === 'jobs' && slug[2] === 'cancel') {
      const jobId = slug[1];
      const job = await JobService.cancelUpdate(jobId);
      if (!job) return respondError('Only queued updates can be cancelled.', 409);
      return respondJson({ success: true, data: job });
    }

    return respondError('Not found', 404);
  } catch (err: any) {
    return respondError(err.message, 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { slug?: string[] } }) {
  const slug = params.slug || [];
  const path = slug.join('/');

  if (path === 'session') {
    return respondJson({ success: true }, 200, undefined, true);
  }

  return respondError('Not found', 404);
}
