import { z } from 'zod';

export type UpdateStatus = 'up_to_date' | 'update_available' | 'unknown' | 'unsupported';
export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type UpdateJobStatus = 'pending_confirmation' | 'queued' | 'in_progress' | 'succeeded' | 'failed' | 'cancelled';
export type DeviceStatus = 'online' | 'offline' | 'unpaired';
export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface Device {
  id: string;
  name: string;
  osVersion: string;
  agentVersion: string;
  lastSeen: string;
  status: DeviceStatus;
  token?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Application {
  id: string;
  deviceId: string;
  displayName: string;
  publisher?: string | null;
  installedVersion: string;
  availableVersion?: string | null;
  packageId?: string | null;
  source: string; // 'winget' | 'registry' | 'manual'
  updateStatus: UpdateStatus;
  releaseDate?: string | null;
  changelogUrl?: string | null;
  homepageUrl?: string | null;
  lastScannedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReleaseMetadata {
  id: string;
  packageId: string;
  version: string;
  channel?: string | null;
  releaseDate?: string | null;
  changelogUrl?: string | null;
  releaseNotes?: string | null;
  source: string;
  fetchedTime: string;
}

export interface ScanJob {
  id: string;
  deviceId: string;
  state: JobStatus;
  totalApps: number;
  updatesFound: number;
  startMessage?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface UpdateJob {
  id: string;
  deviceId: string;
  applicationId: string;
  applicationName: string;
  packageId: string;
  fromVersion: string;
  targetVersion: string;
  state: UpdateJobStatus;
  initiator: string; // 'user' | 'agent'
  exitCode?: number | null;
  outputLogs?: string | null;
  verificationResult?: string | null;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface SecurityFinding {
  id: string;
  packageId: string;
  packageName: string;
  installedVersion: string;
  advisoryId: string; // CVE or GHSA
  title: string;
  severity: SeverityLevel;
  affectedRange: string;
  fixedVersion?: string | null;
  source: string;
  summary: string;
  lastVerifiedTime: string;
}

export interface AuditEvent {
  id: string;
  deviceId?: string | null;
  actor: string;
  eventType: string;
  target: string;
  timestamp: string;
  metadata?: string | null; // JSON string
}

export interface DashboardMetrics {
  totalApplications: number;
  updatesAvailable: number;
  upToDate: number;
  unsupportedOrUnknown: number;
  securityAdvisoriesCount: number;
  connectedDevices: number;
  lastScanTime?: string | null;
  agentStatus: DeviceStatus;
}

// Validation schemas for API and Agent communication
export const PairAgentSchema = z.object({
  deviceName: z.string().min(1),
  osVersion: z.string().min(1),
  agentVersion: z.string().min(1),
  pairingToken: z.string().optional()
});

export const DetectedAppSchema = z.object({
  displayName: z.string().min(1),
  publisher: z.string().optional().nullable(),
  installedVersion: z.string().min(1),
  availableVersion: z.string().optional().nullable(),
  packageId: z.string().optional().nullable(),
  source: z.string().default('winget'),
  updateStatus: z.enum(['up_to_date', 'update_available', 'unknown', 'unsupported']),
  releaseDate: z.string().optional().nullable(),
  changelogUrl: z.string().optional().nullable(),
  homepageUrl: z.string().optional().nullable()
});

export const ReportScanResultSchema = z.object({
  scanJobId: z.string(),
  deviceId: z.string(),
  applications: z.array(DetectedAppSchema),
  error: z.string().optional()
});

export const ExecuteUpdateSchema = z.object({
  applicationId: z.string(),
  targetVersion: z.string().optional(),
  confirmedByUser: z.boolean().refine(val => val === true, {
    message: 'Explicit user confirmation is mandatory before executing an update'
  })
});

export const UpdateJobResultSchema = z.object({
  jobId: z.string(),
  exitCode: z.number(),
  outputLogs: z.string(),
  verifiedInstalledVersion: z.string().optional().nullable(),
  verificationPassed: z.boolean()
});
