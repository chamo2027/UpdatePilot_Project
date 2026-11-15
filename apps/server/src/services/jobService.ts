import { prisma } from '../prisma';
import { AuditService } from './auditService';

export class JobService {
  static async createScanJob(deviceId: string, actor = 'user') {
    const job = await prisma.scanJob.create({
      data: {
        deviceId,
        state: actor === 'agent' ? 'running' : 'queued',
        startedAt: actor === 'agent' ? new Date() : undefined,
        startMessage: actor === 'agent' ? 'Scan started by Windows agent' : 'Scan requested from dashboard',
      },
    });

    await AuditService.record({
      actor,
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

    if (app.source !== 'winget' || !app.packageId || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(app.packageId)) {
      throw new Error('Application does not have a verified package ID for automated update');
    }

    if (!app.availableVersion) {
      throw new Error('No target update version available');
    }

    // Safety checks
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
        supportedSource: true,
        knownPackageIdentifier: true,
        majorVersionJump: hasBreakingChangeRisk,
        requiresElevation: true,
        message: 'Package is matched to the Windows Package Manager community source.',
      },
    };
  }

  static async executeUpdate(params: {
    applicationId: string;
    targetVersion: string;
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

    if (app.source !== 'winget' || app.updateStatus !== 'update_available' ||
        !app.packageId || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(app.packageId) ||
        app.availableVersion !== params.targetVersion) {
      throw new Error('Application missing package identity or available version');
    }

    const job = await prisma.$transaction(async tx => {
      const active = await tx.updateJob.findFirst({
        where: { deviceId: app.deviceId, packageId: app.packageId!, state: { in: ['queued', 'in_progress'] } },
      });
      if (active) throw new Error('An update for this package is already pending.');
      return tx.updateJob.create({
        data: {
          deviceId: app.deviceId,
          applicationId: app.id,
          applicationName: app.displayName,
          packageId: app.packageId!,
          fromVersion: app.installedVersion,
          targetVersion: params.targetVersion,
          state: 'queued',
          initiator: params.initiator || 'user',
        },
      });
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

  static async cancelUpdate(id: string) {
    return prisma.$transaction(async tx => {
      const changed = await tx.updateJob.updateMany({
        where: { id, state: 'queued' },
        data: { state: 'cancelled', completedAt: new Date(), verificationResult: 'Cancelled before execution' },
      });
      if (!changed.count) return null;
      const job = await tx.updateJob.findUniqueOrThrow({ where: { id } });
      await tx.auditEvent.create({
        data: { actor: 'user', deviceId: job.deviceId, eventType: 'UPDATE_CANCELLED', target: job.applicationName },
      });
      return job;
    });
  }

  static async reportUpdateResult(params: {
    jobId: string;
    deviceId: string;
    exitCode: number;
    outputLogs: string;
    verifiedInstalledVersion?: string | null;
    verificationPassed: boolean;
    restartRequired?: boolean;
  }) {
    const job = await prisma.updateJob.findFirst({
      where: { id: params.jobId, deviceId: params.deviceId, state: 'in_progress' },
    });

    if (!job) {
      return null;
    }

    const rebootCodes = [3010, 1641, -1978335189, -1978335188];
    const isRebootRequired = Boolean(params.restartRequired || rebootCodes.includes(params.exitCode));

    const verified = params.verificationPassed && params.exitCode === 0 &&
      params.verifiedInstalledVersion === job.targetVersion;
    const restartPending = isRebootRequired && (params.verificationPassed || params.verifiedInstalledVersion === job.targetVersion || params.exitCode === 3010 || params.exitCode === 1641);

    let state = 'failed';
    let verificationResult = 'Verification failed or version mismatch';

    if (verified) {
      state = 'succeeded';
      verificationResult = 'Verified successfully';
    } else if (restartPending) {
      state = 'restart_required';
      verificationResult = 'Update files applied. A system restart is required to complete installation.';
    } else if (params.exitCode === 1603) {
      verificationResult = 'Installer failed with exit code 1603. Elevation or interactive approval may be required.';
    }

    const updatedJob = await prisma.$transaction(async tx => {
      const updated = await tx.updateJob.updateMany({
        where: { id: job.id, deviceId: params.deviceId, state: 'in_progress' },
        data: {
          state,
          exitCode: params.exitCode,
          outputLogs: params.outputLogs.slice(0, 64_000),
          verifiedVersion: params.verifiedInstalledVersion,
          verificationResult,
          completedAt: new Date(),
        },
      });
      if (!updated.count) return null;

      if (verified) {
        await tx.application.update({
          where: { id: job.applicationId },
          data: {
            installedVersion: job.targetVersion,
            availableVersion: null,
            updateStatus: 'up_to_date',
            lastScannedAt: new Date(),
          },
        });
      } else if (restartPending) {
        await tx.application.update({
          where: { id: job.applicationId },
          data: {
            installedVersion: params.verifiedInstalledVersion || job.targetVersion,
            availableVersion: null,
            updateStatus: 'unknown',
            lastScannedAt: new Date(),
          },
        });
      }
      return tx.updateJob.findUnique({ where: { id: job.id } });
    });
    if (!updatedJob) return null;

    await AuditService.record({
      actor: 'agent',
      deviceId: job.deviceId,
      eventType: state === 'succeeded' ? 'UPDATE_SUCCESS' : state === 'restart_required' ? 'UPDATE_RESTART_REQUIRED' : 'UPDATE_FAILED',
      target: `${job.applicationName} to ${job.targetVersion}`,
      metadata: {
        jobId: job.id,
        exitCode: params.exitCode,
        verifiedVersion: params.verifiedInstalledVersion,
        restartRequired: isRebootRequired,
      },
    });

    return updatedJob;
  }

  static async pollPendingJobs(deviceId: string) {
    return prisma.$transaction(async tx => {
      const activeUpdate = await tx.updateJob.findFirst({ where: { deviceId, state: 'in_progress' } });
      const activeScan = await tx.scanJob.findFirst({ where: { deviceId, state: 'running' } });
      if (activeUpdate || activeScan) return null;
      const updateJob = await tx.updateJob.findFirst({
        where: { deviceId, state: 'queued' },
        orderBy: { createdAt: 'asc' },
      });
      if (updateJob) {
        const claim = await tx.updateJob.updateMany({
          where: { id: updateJob.id, state: 'queued' },
          data: { state: 'in_progress', startedAt: new Date() },
        });
        return claim.count ? { type: 'update', job: updateJob } : null;
      }

      const scanJob = await tx.scanJob.findFirst({
        where: { deviceId, state: 'queued' },
        orderBy: { createdAt: 'asc' },
      });
      if (!scanJob) return null;
      const claim = await tx.scanJob.updateMany({
        where: { id: scanJob.id, state: 'queued' },
        data: { state: 'running', startedAt: new Date() },
      });
      return claim.count ? { type: 'scan', job: scanJob } : null;
    });
  }

  static async expireStaleJobs() {
    const now = new Date();
    const cutoff = (minutes: number) => new Date(now.getTime() - minutes * 60_000);
    await prisma.$transaction([
      prisma.scanJob.updateMany({
        where: { OR: [
          { state: 'running', startedAt: { lt: cutoff(5) } },
          { state: 'queued', createdAt: { lt: cutoff(10) } },
        ] },
        data: { state: 'failed', completedAt: now, errorMessage: 'Scan timed out. Check the agent connection and start a new scan.' },
      }),
      prisma.updateJob.updateMany({
        where: { OR: [
          { state: 'in_progress', startedAt: { lt: cutoff(20) } },
          { state: 'queued', createdAt: { lt: cutoff(10) } },
        ] },
        data: { state: 'failed', completedAt: now, verificationResult: 'Update was not verified before the deadline. Scan again before retrying.' },
      }),
    ]);
  }

  static async pruneDiagnostics() {
    const days = Number(process.env.DIAGNOSTIC_RETENTION_DAYS ?? '30');
    if (!Number.isSafeInteger(days) || days < 0 || days > 3650) {
      throw new Error('DIAGNOSTIC_RETENTION_DAYS must be an integer from 0 to 3650.');
    }
    const completedAt = { lt: new Date(Date.now() - days * 86_400_000) };
    await prisma.$transaction([
      prisma.updateJob.updateMany({
        where: { completedAt, outputLogs: { not: null } }, data: { outputLogs: null },
      }),
      prisma.scanJob.updateMany({
        where: { completedAt, inventorySnapshot: { not: null } }, data: { inventorySnapshot: null },
      }),
    ]);
  }
}
