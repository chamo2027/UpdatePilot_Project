import { Router, Request, Response } from 'express';
import { InventoryService } from '../services/inventoryService';
import { DeviceService } from '../services/deviceService';
import { JobService } from '../services/jobService';
import { SecurityService } from '../services/securityService';
import { AuditService } from '../services/auditService';
import { AuthService } from '../services/authService';
import { protectDashboard, setSessionCookie, clearSessionCookie } from '../access';
import { prisma } from '../prisma';
import { setupSwagger } from '../openapi';
import {
  PairAgentSchema,
  ReportScanResultSchema,
  ExecuteUpdateSchema,
  UpdateJobResultSchema,
  UpdateProgressSchema,
} from '@updatepilot/shared';

export const router = Router();
setupSwagger(router);
protectDashboard(router);

// ==========================================
// 0. User Authentication & Profile
// ==========================================
router.post('/auth/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body || {};
    if (!email || !password || !name) {
      return res.status(400).json({ success: false, error: 'Email, password, and name are required.' });
    }
    const user = await AuthService.register({ email, password, name });
    const origin = req.get('origin')?.replace(/\/$/, '');
    setSessionCookie(res, user.id, origin);
    return res.status(201).json({ success: true, data: user });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required.' });
    }
    const user = await AuthService.login({ email, password });
    const origin = req.get('origin')?.replace(/\/$/, '');
    setSessionCookie(res, user.id, origin);
    return res.json({ success: true, data: user });
  } catch (error: any) {
    return res.status(401).json({ success: false, error: error.message });
  }
});

router.get('/auth/me', async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });
    if (userId === 'admin') {
      const admin = await prisma.user.findFirst({ where: { role: 'admin' } });
      return res.json({
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
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    return res.json({ success: true, data: user });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/auth/logout', (req: Request, res: Response) => {
  const origin = req.get('origin')?.replace(/\/$/, '');
  clearSessionCookie(res, origin);
  return res.json({ success: true });
});

router.get('/install-agent.ps1', (req: Request, res: Response) => {
  const code = (req.query.code as string) || '';
  const protocol = req.protocol;
  const host = req.get('host');
  const serverUrl = `${protocol}://${host}/api/v1`;

  const script = `# UpdatePilot Windows Host Agent - Quick Connect Script
$ErrorActionPreference = 'Stop'
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   UpdatePilot - Connecting this Windows PC...            " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$serverUrl = "${serverUrl}"
$pairingCode = "${code}"

if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Windows Package Manager (winget) is required." -ForegroundColor Red
    exit 1
}

Write-Host "Target Server: $serverUrl" -ForegroundColor Green
Write-Host "Pairing Key:   $pairingCode" -ForegroundColor Yellow
Write-Host "To link your machine, run the agent with:" -ForegroundColor Cyan
Write-Host "  \\$env:SERVER_URL='$serverUrl'" -ForegroundColor White
Write-Host "  \\$env:AGENT_PAIRING_CODE='$pairingCode'" -ForegroundColor White
Write-Host "  npm run dev:agent" -ForegroundColor White
`;
  res.type('text/plain').send(script);
});

router.use('/agent', async (req, res, next) => {
  try {
    const token = req.get('authorization')?.match(/^Bearer (up_tok_[a-f0-9]{64})$/)?.[1];
    const device = token && await DeviceService.authenticate(token);
    if (!device) return res.status(401).json({ error: 'Agent credentials are invalid or revoked.' });
    res.locals.deviceId = device.id;
    return next();
  } catch (error) {
    return next(error);
  }
});

// ==========================================
// 1. Dashboard Metrics
// ==========================================
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const metrics = await InventoryService.getDashboardMetrics(res.locals.userId);
    return res.json({ success: true, data: metrics });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 2. Devices & Pairing
// ==========================================
router.get('/devices', async (req: Request, res: Response) => {
  try {
    const devices = await DeviceService.getDevices(res.locals.userId);
    return res.json({ success: true, data: devices });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/devices/pair', async (req: Request, res: Response) => {
  try {
    const parse = PairAgentSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, error: parse.error.format() });
    }
    const result = await DeviceService.pairDevice(parse.data);
    return res.json({ success: true, data: result });
  } catch (error: any) {
    return res.status(403).json({ success: false, error: 'Pairing refused. Check the pairing code or existing credentials.' });
  }
});

router.post('/devices/:id/revoke', async (req: Request, res: Response) => {
  try {
    const result = await DeviceService.revokeDevice(req.params.id);
    return res.json({ success: true, data: result });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 3. Scans & Jobs
// ==========================================
router.post('/devices/:id/scans', async (req: Request, res: Response) => {
  try {
    const job = await JobService.createScanJob(req.params.id);
    return res.status(202).json({ success: true, data: job });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/scans/:id', async (req: Request, res: Response) => {
  try {
    const job = await JobService.getScanJob(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Scan job not found' });
    }
    return res.json({ success: true, data: job });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 4. Applications Inventory
// ==========================================
router.get('/applications', async (req: Request, res: Response) => {
  try {
    const { deviceId, search, status, source, sortBy, sortOrder, page, pageSize } = req.query;
    const result = await InventoryService.getApplications({
      userId: res.locals.userId,
      deviceId: deviceId as string,
      search: search as string,
      status: status as string,
      source: source as string,
      sortBy: sortBy as any,
      sortOrder: sortOrder as any,
      page: page ? parseInt(page as string, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize as string, 10) : undefined,
    });
    return res.json({ success: true, ...result });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/applications/:id', async (req: Request, res: Response) => {
  try {
    const app = await InventoryService.getApplicationById(req.params.id);
    if (!app) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }
    return res.json({ success: true, data: app });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 5. Updates & Safe Execution
// ==========================================
router.get('/updates', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.query;
    const updates = await InventoryService.getAvailableUpdates(res.locals.userId, deviceId as string);
    return res.json({ success: true, data: updates });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/updates/:id/preview', async (req: Request, res: Response) => {
  try {
    const preview = await JobService.previewUpdate(req.params.id);
    return res.json({ success: true, data: preview });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/updates/:id/execute', async (req: Request, res: Response) => {
  try {
    const parse = ExecuteUpdateSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, error: parse.error.format() });
    }

    if (req.params.id !== parse.data.applicationId) return res.status(400).json({ error: 'Application ID mismatch.' });
    const job = await JobService.executeUpdate({
      applicationId: req.params.id,
      targetVersion: parse.data.targetVersion,
      confirmedByUser: parse.data.confirmedByUser,
      initiator: 'user',
    });
    return res.status(202).json({ success: true, data: job });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/jobs/:id', async (req: Request, res: Response) => {
  try {
    const job = await JobService.getUpdateJob(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }
    return res.json({ success: true, data: job });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/jobs/:id/cancel', async (req, res, next) => {
  try {
    const job = await JobService.cancelUpdate(req.params.id);
    if (!job) return res.status(409).json({ error: 'Only queued updates can be cancelled.' });
    return res.json({ success: true, data: job });
  } catch (error) {
    return next(error);
  }
});

// ==========================================
// 6. History & Reporting
// ==========================================
router.get('/history', async (req: Request, res: Response) => {
  try {
    const history = await AuditService.getHistory(100, res.locals.userId);
    return res.json({ success: true, data: history });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/reports/:kind', async (req, res, next) => {
  try {
    if (req.params.kind === 'inventory') {
      const applications = await prisma.application.findMany({ orderBy: { displayName: 'asc' } });
      return res.json({ success: true, data: applications });
    }
    if (req.params.kind === 'updates') {
      const jobs = await prisma.updateJob.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, deviceId: true, applicationName: true, packageId: true, fromVersion: true,
          targetVersion: true, verifiedVersion: true, state: true, exitCode: true, verificationResult: true,
          createdAt: true, completedAt: true,
        },
      });
      return res.json({ success: true, data: jobs });
    }
    return res.sendStatus(404);
  } catch (error) {
    return next(error);
  }
});

// ==========================================
// 7. Security Intelligence
// ==========================================
router.get('/security/findings', async (req: Request, res: Response) => {
  try {
    const findings = await SecurityService.getFindings();
    return res.json({ success: true, data: findings });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 8. Agent API Channel (Protected & Narrow)
// ==========================================
router.post('/agent/heartbeat', async (req: Request, res: Response) => {
  try {
    const { deviceId } = res.locals;
    const device = await DeviceService.heartbeat(deviceId);
    return res.json({ success: true, data: { status: device.status } });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/agent/jobs/pending', async (req: Request, res: Response) => {
  try {
    const pendingJob = await JobService.pollPendingJobs(res.locals.deviceId);
    return res.json({ success: true, data: pendingJob });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/agent/scans', async (_req, res, next) => {
  try {
    const job = await JobService.createScanJob(res.locals.deviceId, 'agent');
    return res.status(202).json({ success: true, data: job });
  } catch (error) {
    return next(error);
  }
});

router.post('/agent/scans/report', async (req: Request, res: Response) => {
  try {
    const parse = ReportScanResultSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, error: parse.error.format() });
    }
    const job = await prisma.scanJob.findFirst({
      where: { id: parse.data.scanJobId, deviceId: res.locals.deviceId, state: 'running' },
    });
    if (!job || parse.data.deviceId !== job.deviceId) return res.status(404).json({ error: 'Active scan not found.' });
    if (parse.data.error) {
      await prisma.scanJob.update({
        where: { id: job.id },
        data: { state: 'failed', errorMessage: parse.data.error, completedAt: new Date() },
      });
      await AuditService.record({ actor: 'agent', deviceId: job.deviceId, eventType: 'SCAN_FAILED', target: job.id });
      return res.json({ success: true });
    }
    const result = await InventoryService.reportScanResult({
      deviceId: parse.data.deviceId,
      scanJobId: parse.data.scanJobId,
      applications: parse.data.applications,
    });
    if (!result) return res.status(404).json({ error: 'Active scan not found.' });
    return res.json({ success: true, data: result });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/agent/updates/report', async (req: Request, res: Response) => {
  try {
    const parse = UpdateJobResultSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, error: parse.error.format() });
    }
    const result = await JobService.reportUpdateResult({
      deviceId: res.locals.deviceId,
      jobId: parse.data.jobId,
      exitCode: parse.data.exitCode,
      outputLogs: parse.data.outputLogs,
      verifiedInstalledVersion: parse.data.verifiedInstalledVersion,
      verificationPassed: parse.data.verificationPassed,
      restartRequired: parse.data.restartRequired,
    });
    if (!result) return res.status(404).json({ error: 'Active update not found.' });
    return res.json({ success: true, data: result });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/agent/updates/progress', async (req: Request, res: Response) => {
  try {
    const parse = UpdateProgressSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, error: parse.error.format() });
    }
    const result = await JobService.updateJobProgress({
      deviceId: res.locals.deviceId,
      jobId: parse.data.jobId,
      progressPercent: parse.data.progressPercent,
      progressPhase: parse.data.progressPhase,
      progressMessage: parse.data.progressMessage,
    });
    return res.json({ success: true, count: result.count });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});
