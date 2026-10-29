import { prisma } from '../prisma';
import { AuditService } from './auditService';

export class JobService {
  static async createScanJob(deviceId: string) {
    const job = await prisma.scanJob.create({
      data: {
        deviceId,
        state: 'queued',
        startMessage: 'Scan requested from Web Dashboard',
      },
    });

    await AuditService.record({
      actor: 'user',
      deviceId,
      eventType: 'SCAN_REQUESTED',
      target: `Job ${job.id}`,
    });

    return job;
  }

  static async getScanJob(id: string) {
    return prisma.scanJob.findUnique({
      where: { id },
      include: {
        device: {
          select: { name: true, osVersion: true, status: true },
        },
      },
    });
  }

  static async previewUpdate(applicationId: string) {
    const app = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        device: true,
      },
    });

    if (!app) {
      throw new Error('Application not found');
    }

    if (!app.packageId) {
      throw new Error('Application does not have a verified package ID for automated update');
    }

    if (!app.availableVersion) {
      throw new Error('No target update version available');
    }

    // Safety checks
    const isWinget = app.source === 'winget';
    const hasBreakingChangeRisk = app.installedVersion.split('.')[0] !== app.availableVersion.split('.')[0];

    return {
      applicationId: app.id,
      displayName: app.displayName,
      packageId: app.packageId,
      currentVersion: app.installedVersion,
      targetVersion: app.availableVersion,
      source: app.source,
      deviceId: app.deviceId,
      deviceName: app.device.name,
      safetyCheck: {
        supportedSource: isWinget,
        knownPackageIdentifier: true,
        majorVersionJump: hasBreakingChangeRisk,
        requiresElevation: true,
        message: isWinget
          ? 'Package is matched to an official Windows Package Manager (WinGet) identity.'
          : 'Custom source updater: verification will be validated post-install.',
      },
    };
  }

  static async executeUpdate(params: {
    applicationId: string;
    initiator?: string;
    confirmedByUser: boolean;
  }) {
    if (!params.confirmedByUser) {
      throw new Error('Explicit user confirmation is required to initiate an update');
    }

    const app = await prisma.application.findUnique({
      where: { id: params.applicationId },
    });

    if (!app) {
      throw new Error('Application not found');
    }

    if (!app.packageId || !app.availableVersion) {
      throw new Error('Application missing package identity or available version');
    }

    // Create queued update job
    const job = await prisma.updateJob.create({
      data: {
        deviceId: app.deviceId,
        applicationId: app.id,
        applicationName: app.displayName,
        packageId: app.packageId,
        fromVersion: app.installedVersion,
        targetVersion: app.availableVersion,
        state: 'queued',
        initiator: params.initiator || 'user',
      },
    });

    await AuditService.record({
      actor: params.initiator || 'user',
      deviceId: app.deviceId,
      eventType: 'UPDATE_CONFIRMED',
      target: `${app.displayName} (${app.installedVersion} -> ${app.availableVersion})`,
      metadata: { jobId: job.id, packageId: app.packageId },
    });

    return job;
  }

  static async getUpdateJob(id: string) {
    return prisma.updateJob.findUnique({
      where: { id },
      include: {
        device: { select: { name: true, status: true } },
        application: true,
      },
    });
  }

  static async reportUpdateResult(params: {
    jobId: string;
    exitCode: number;
    outputLogs: string;
    verifiedInstalledVersion?: string | null;
    verificationPassed: boolean;
  }) {
    const job = await prisma.updateJob.findUnique({
      where: { id: params.jobId },
    });

    if (!job) {
      throw new Error('Update job not found');
    }

    const state = params.verificationPassed && params.exitCode === 0 ? 'succeeded' : 'failed';

    const updatedJob = await prisma.updateJob.update({
      where: { id: params.jobId },
      data: {
        state,
        exitCode: params.exitCode,
        outputLogs: params.outputLogs,
        verificationResult: params.verificationPassed ? 'Verified successfully' : 'Verification failed or version mismatch',
        completedAt: new Date(),
      },
    });

    // If update succeeded and verified, update application record
    if (params.verificationPassed && params.exitCode === 0 && params.verifiedInstalledVersion) {
      await prisma.application.update({
        where: { id: job.applicationId },
        data: {
          installedVersion: params.verifiedInstalledVersion,
          availableVersion: null,
          updateStatus: 'up_to_date',
          lastScannedAt: new Date(),
        },
      });
    }

    await AuditService.record({
      actor: 'agent',
      deviceId: job.deviceId,
      eventType: state === 'succeeded' ? 'UPDATE_SUCCESS' : 'UPDATE_FAILED',
      target: `${job.applicationName} to ${job.targetVersion}`,
      metadata: {
        jobId: job.id,
        exitCode: params.exitCode,
        verifiedVersion: params.verifiedInstalledVersion,
      },
    });

    return updatedJob;
  }

  static async pollPendingJobs(deviceId: string) {
    // 1. Check for queued update jobs first (high priority)
    const updateJob = await prisma.updateJob.findFirst({
      where: {
        deviceId,
        state: 'queued',
      },
      orderBy: { createdAt: 'asc' },
    });

    if (updateJob) {
      await prisma.updateJob.update({
        where: { id: updateJob.id },
        data: { state: 'in_progress', startedAt: new Date() },
      });
      return { type: 'update', job: updateJob };
    }

    // 2. Check for queued scan jobs
    const scanJob = await prisma.scanJob.findFirst({
      where: {
        deviceId,
        state: 'queued',
      },
      orderBy: { createdAt: 'asc' },
    });

    if (scanJob) {
      await prisma.scanJob.update({
        where: { id: scanJob.id },
        data: { state: 'running', startedAt: new Date() },
      });
      return { type: 'scan', job: scanJob };
    }

    return null;
  }
}
