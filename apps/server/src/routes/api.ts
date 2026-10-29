import { Router, Request, Response } from 'express';
import { InventoryService } from '../services/inventoryService';
import { DeviceService } from '../services/deviceService';
import { JobService } from '../services/jobService';
import { SecurityService } from '../services/securityService';
import { AuditService } from '../services/auditService';
import {
  PairAgentSchema,
  ReportScanResultSchema,
  ExecuteUpdateSchema,
  UpdateJobResultSchema,
} from '@updatepilot/shared';

export const router = Router();

// ==========================================
// 1. Dashboard Metrics
// ==========================================
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const metrics = await InventoryService.getDashboardMetrics();
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
    const devices = await DeviceService.getDevices();
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
    return res.status(500).json({ success: false, error: error.message });
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
    const updates = await InventoryService.getAvailableUpdates(deviceId as string);
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

    const job = await JobService.executeUpdate({
      applicationId: req.params.id,
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

// ==========================================
// 6. History & Reporting
// ==========================================
router.get('/history', async (req: Request, res: Response) => {
  try {
    const history = await AuditService.getHistory();
    return res.json({ success: true, data: history });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
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
    const { deviceId } = req.body;
    if (!deviceId) {
      return res.status(400).json({ success: false, error: 'Missing deviceId' });
    }
    const device = await DeviceService.heartbeat(deviceId);
    return res.json({ success: true, data: { status: device.status } });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/agent/jobs/pending', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.query;
    if (!deviceId) {
      return res.status(400).json({ success: false, error: 'Missing deviceId' });
    }
    const pendingJob = await JobService.pollPendingJobs(deviceId as string);
    return res.json({ success: true, data: pendingJob });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/agent/scans/report', async (req: Request, res: Response) => {
  try {
    const parse = ReportScanResultSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, error: parse.error.format() });
    }
    const result = await InventoryService.reportScanResult({
      deviceId: parse.data.deviceId,
      scanJobId: parse.data.scanJobId,
      applications: parse.data.applications,
    });
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
      jobId: parse.data.jobId,
      exitCode: parse.data.exitCode,
      outputLogs: parse.data.outputLogs,
      verifiedInstalledVersion: parse.data.verifiedInstalledVersion,
      verificationPassed: parse.data.verificationPassed,
    });
    return res.json({ success: true, data: result });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});
