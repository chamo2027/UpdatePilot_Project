import crypto from 'node:crypto';
import { prisma } from './prisma';
import {
  hashPassword,
  verifyPassword,
  generatePairingCode,
  hashSecret,
  sameSecret,
} from './auth';

// ==========================================
// 1. Audit Service
// ==========================================
export class AuditService {
  static async record(params: {
    actor?: string;
    deviceId?: string | null;
    userId?: string | null;
    eventType: string;
    target: string;
    metadata?: Record<string, any>;
  }) {
    return prisma.auditEvent.create({
      data: {
        actor: params.actor || 'system',
        deviceId: params.deviceId,
        userId: params.userId,
        eventType: params.eventType,
        target: params.target,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      },
    });
  }

  static async getHistory(limit = 100, userId?: string) {
    const where: any = {};
    if (userId && userId !== 'admin') {
      where.OR = [
        { userId },
        { device: { ownerId: userId } },
      ];
    }
    return prisma.auditEvent.findMany({
      where,
      take: limit,
      orderBy: { timestamp: 'desc' },
      include: {
        device: {
          select: { name: true, osVersion: true },
        },
      },
    });
  }
}

// ==========================================
// 2. Auth Service
// ==========================================
export class AuthService {
  static async register(data: { email: string; password: string; name: string }) {
    const email = data.email.trim().toLowerCase();
    const name = data.name.trim();
    const password = data.password;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Please enter a valid email address.');
    }
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters long.');
    }
    if (!name || name.length < 2) {
      throw new Error('Name must be at least 2 characters long.');
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new Error('An account with this email already exists.');
    }

    const totalUsers = await prisma.user.count();
    const role = totalUsers === 0 ? 'admin' : 'user';
    const pairingCode = generatePairingCode();
    const passwordHash = hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        role,
        pairingCode,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        pairingCode: true,
        createdAt: true,
      },
    });

    if (totalUsers === 0) {
      await prisma.device.updateMany({
        where: { ownerId: null },
        data: { ownerId: user.id },
      });
    }

    return user;
  }

  static async login(data: { email: string; password: string }) {
    const email = data.email.trim().toLowerCase();
    const password = data.password;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
      throw new Error('Invalid email or password.');
    }

    let pairingCode = user.pairingCode;
    if (!pairingCode) {
      pairingCode = generatePairingCode();
      await prisma.user.update({
        where: { id: user.id },
        data: { pairingCode },
      });
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      pairingCode,
      createdAt: user.createdAt,
    };
  }

  static async getUserById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        pairingCode: true,
        createdAt: true,
      },
    });
  }

  static async getUserByPairingCode(code: string) {
    const normalized = code.trim().toUpperCase();
    return prisma.user.findFirst({
      where: { pairingCode: normalized },
    });
  }
}

// ==========================================
// 3. Device Service
// ==========================================
export class DeviceService {
  static async pairDevice(data: {
    deviceName: string;
    osVersion: string;
    agentVersion: string;
    pairingToken?: string;
    pairingCode?: string;
  }) {
    let existing = data.pairingToken ? await this.authenticate(data.pairingToken) : null;
    let ownerId: string | null = null;

    if (data.pairingCode) {
      const matchedUser = await AuthService.getUserByPairingCode(data.pairingCode);
      if (matchedUser) {
        ownerId = matchedUser.id;
      }
    }

    const globalCode = process.env.AGENT_PAIRING_CODE;
    if (!ownerId && globalCode && globalCode.length >= 24 && data.pairingCode && sameSecret(data.pairingCode, globalCode)) {
      const adminUser = await prisma.user.findFirst({ where: { role: 'admin' } });
      ownerId = adminUser ? adminUser.id : null;
    }

    if (!existing && !ownerId) {
      throw new Error('Invalid pairing credentials.');
    }

    if (!existing && data.deviceName) {
      existing = await prisma.device.findFirst({
        where: { name: data.deviceName, status: { not: 'unpaired' } },
        select: { id: true, ownerId: true },
      });
    }

    const token = 'up_tok_' + crypto.randomBytes(32).toString('hex');
    const metadata = { osVersion: data.osVersion, agentVersion: data.agentVersion };
    const device = existing
      ? await prisma.device.update({
          where: { id: existing.id },
          data: {
            ...metadata,
            lastSeen: new Date(),
            status: 'online',
            token: hashSecret(token),
            ...(ownerId ? { ownerId } : {}),
          },
        })
      : await prisma.device.create({
          data: {
            ...metadata,
            name: data.deviceName,
            ownerId,
            status: 'online',
            token: hashSecret(token),
          },
        });

    if (!existing) {
      await AuditService.record({
        actor: 'agent',
        deviceId: device.id,
        eventType: 'AGENT_PAIRED',
        target: device.name,
        metadata,
      });
    }
    return { deviceId: device.id, name: device.name, token, status: device.status };
  }

  static authenticate(token: string) {
    return prisma.device.findFirst({
      where: { token: hashSecret(token), status: { not: 'unpaired' } },
      select: { id: true, ownerId: true },
    });
  }

  static heartbeat(deviceId: string) {
    return prisma.device.update({
      where: { id: deviceId, status: { not: 'unpaired' } },
      data: { lastSeen: new Date(), status: 'online' },
    });
  }

  static async getDevices(userId?: string) {
    await prisma.device.updateMany({
      where: { lastSeen: { lt: new Date(Date.now() - 60_000) }, status: 'online' },
      data: { status: 'offline' },
    });

    const where: any = {};
    if (userId && userId !== 'admin') {
      where.ownerId = userId;
    }

    const devices = await prisma.device.findMany({
      where,
      orderBy: { lastSeen: 'desc' },
      include: { _count: { select: { applications: true } } },
    });
    return devices.map(({ token, ...device }) => device);
  }

  static async revokeDevice(deviceId: string, userId?: string) {
    if (userId && userId !== 'admin') {
      const dev = await prisma.device.findFirst({ where: { id: deviceId, ownerId: userId } });
      if (!dev) throw new Error('Device not found or not owned by you.');
    }

    const device = await prisma.device.update({
      where: { id: deviceId },
      data: { status: 'unpaired', token: hashSecret(crypto.randomBytes(32).toString('hex')) },
    });
    await AuditService.record({ actor: 'user', deviceId, eventType: 'AGENT_REVOKED', target: device.name });
    return { id: device.id, status: device.status };
  }
}

// ==========================================
// 4. Security Service
// ==========================================
export class SecurityService {
  static async getFindings(_applicationId?: string) {
    return [];
  }
}

// ==========================================
// 5. Inventory Service
// ==========================================
export class InventoryService {
  static async reportScanResult(params: {
    deviceId: string;
    scanJobId: string;
    applications: Array<{
      displayName: string;
      publisher?: string | null;
      installedVersion: string;
      availableVersion?: string | null;
      packageId?: string | null;
      source: string;
      updateStatus: string;
      releaseDate?: string | null;
      changelogUrl?: string | null;
      homepageUrl?: string | null;
    }>;
  }) {
    const { deviceId, scanJobId, applications } = params;

    const updatesFound = await prisma.$transaction(async tx => {
      const scannedAt = new Date();
      const claimed = await tx.scanJob.updateMany({
        where: { id: scanJobId, deviceId, state: 'running' },
        data: { state: 'completed', completedAt: scannedAt },
      });
      if (!claimed.count) return null;
      let count = 0;

      for (const app of applications) {
        if (app.updateStatus === 'update_available') {
          count++;
        }

        const existing = await tx.application.findFirst({
          where: {
            deviceId,
            displayName: app.displayName,
            packageId: app.packageId || null,
          },
        });

        if (existing) {
          await tx.application.update({
            where: { id: existing.id },
            data: {
              installedVersion: app.installedVersion,
              availableVersion: app.availableVersion,
              publisher: app.publisher,
              updateStatus: app.updateStatus,
              source: app.source,
              releaseDate: app.releaseDate,
              changelogUrl: app.changelogUrl,
              homepageUrl: app.homepageUrl,
              lastScannedAt: scannedAt,
            },
          });
        } else {
          await tx.application.create({
            data: {
              deviceId,
              displayName: app.displayName,
              publisher: app.publisher,
              installedVersion: app.installedVersion,
              availableVersion: app.availableVersion,
              packageId: app.packageId,
              source: app.source,
              updateStatus: app.updateStatus,
              releaseDate: app.releaseDate,
              changelogUrl: app.changelogUrl,
              homepageUrl: app.homepageUrl,
              lastScannedAt: scannedAt,
            },
          });
        }

        if (app.packageId && app.availableVersion) {
          await tx.releaseMetadata.upsert({
            where: {
              packageId_version: {
                packageId: app.packageId,
                version: app.availableVersion,
              },
            },
            update: {
              releaseDate: app.releaseDate,
              changelogUrl: app.changelogUrl,
              source: app.source,
              fetchedTime: new Date(),
            },
            create: {
              packageId: app.packageId,
              version: app.availableVersion,
              releaseDate: app.releaseDate,
              changelogUrl: app.changelogUrl,
              source: app.source,
              fetchedTime: new Date(),
            },
          });
        }
      }

      await tx.application.updateMany({
        where: { deviceId, lastScannedAt: { lt: scannedAt } },
        data: { updateStatus: 'unknown', availableVersion: null },
      });

      await tx.scanJob.update({
        where: { id: scanJobId },
        data: {
          state: 'completed',
          totalApps: applications.length,
          updatesFound: count,
          inventorySnapshot: JSON.stringify(applications),
        },
      });
      return count;
    }, { timeout: 30_000 });

    if (updatesFound === null) return null;

    await AuditService.record({
      actor: 'agent',
      deviceId,
      eventType: 'SCAN_COMPLETED',
      target: `Job ${scanJobId}`,
      metadata: { totalApps: applications.length, updatesFound },
    });

    return { totalApps: applications.length, updatesFound };
  }

  static async getApplications(params: {
    userId?: string;
    deviceId?: string;
    search?: string;
    status?: string;
    source?: string;
    sortBy?: 'displayName' | 'updateStatus' | 'publisher' | 'lastScannedAt';
    sortOrder?: 'asc' | 'desc';
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.max(1, Math.min(100, params.pageSize || 20));
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (params.userId && params.userId !== 'admin') {
      where.device = { ...(where.device || {}), ownerId: params.userId };
    }
    if (params.deviceId) {
      where.deviceId = params.deviceId;
    }
    if (params.status && params.status !== 'all') {
      where.updateStatus = params.status;
    }
    if (params.source && params.source !== 'all') {
      where.source = params.source;
    }
    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      where.OR = [
        { displayName: { contains: q, mode: 'insensitive' } },
        { packageId: { contains: q, mode: 'insensitive' } },
        { publisher: { contains: q, mode: 'insensitive' } },
      ];
    }

    const orderBy: any = {};
    const sortField = params.sortBy || 'displayName';
    orderBy[sortField] = params.sortOrder || 'asc';

    const [items, total] = await Promise.all([
      prisma.application.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
      }),
      prisma.application.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  static async getApplicationById(id: string) {
    const app = await prisma.application.findUnique({
      where: { id },
      include: {
        device: { select: { id: true, name: true, osVersion: true, status: true } },
        updateJobs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!app) return null;

    let releaseMetadata = null;
    if (app.packageId && app.availableVersion) {
      releaseMetadata = await prisma.releaseMetadata.findFirst({
        where: {
          packageId: app.packageId,
          version: app.availableVersion,
        },
      });
    }

    return {
      ...app,
      releaseMetadata,
      securityFindings: [],
    };
  }

  static async getAvailableUpdates(userId?: string, deviceId?: string) {
    const where: any = {
      updateStatus: 'update_available',
    };
    if (userId && userId !== 'admin') {
      where.device = { ...(where.device || {}), ownerId: userId };
    }
    if (deviceId) {
      where.deviceId = deviceId;
    } else {
      where.device = { ...(where.device || {}), status: 'online' };
    }

    return prisma.application.findMany({
      where,
      orderBy: { displayName: 'asc' },
      include: {
        device: { select: { id: true, name: true } },
      },
    });
  }

  static async getDashboardMetrics(userId?: string) {
    const appFilter: any = {};
    const devFilter: any = {};
    const scanFilter: any = { state: 'completed' };

    if (userId && userId !== 'admin') {
      appFilter.device = { ownerId: userId };
      devFilter.ownerId = userId;
      scanFilter.device = { ownerId: userId };
    }

    const [
      totalApplications,
      updatesAvailable,
      upToDate,
      unsupportedOrUnknown,
      activeDevices,
      lastScanJob,
    ] = await Promise.all([
      prisma.application.count({ where: appFilter }),
      prisma.application.count({ where: { ...appFilter, updateStatus: 'update_available' } }),
      prisma.application.count({ where: { ...appFilter, updateStatus: 'up_to_date' } }),
      prisma.application.count({
        where: { ...appFilter, updateStatus: { in: ['unknown', 'unsupported'] } },
      }),
      prisma.device.count({ where: { ...devFilter, status: 'online' } }),
      prisma.scanJob.findFirst({
        where: scanFilter,
        orderBy: { completedAt: 'desc' },
      }),
    ]);

    const primaryDevice = await prisma.device.findFirst({
      where: devFilter,
      orderBy: { lastSeen: 'desc' },
    });

    return {
      totalApplications,
      updatesAvailable,
      upToDate,
      unsupportedOrUnknown,
      securityAdvisoriesCount: 0,
      connectedDevices: activeDevices,
      lastScanTime: lastScanJob?.completedAt ? lastScanJob.completedAt.toISOString() : null,
      agentStatus: primaryDevice ? (primaryDevice.status as any) : 'offline',
    };
  }
}

// ==========================================
// 6. Job Service
// ==========================================
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
      include: { device: true },
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

    if (!job) return null;

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
          progressPercent: state === 'succeeded' ? 100 : 0,
          progressPhase: state === 'succeeded' ? 'completed' : 'failed',
          progressMessage: state === 'succeeded' ? 'Update installed and verified successfully.' : 'Update execution failed.',
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
          data: {
            state: 'in_progress',
            startedAt: new Date(),
            progressPercent: 5,
            progressPhase: 'downloading',
            progressMessage: 'Initializing download...',
          },
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

  static async updateJobProgress(params: {
    deviceId: string;
    jobId: string;
    progressPercent: number;
    progressPhase: string;
    progressMessage?: string;
  }) {
    return prisma.updateJob.updateMany({
      where: { id: params.jobId, deviceId: params.deviceId, state: 'in_progress' },
      data: {
        progressPercent: params.progressPercent,
        progressPhase: params.progressPhase,
        progressMessage: params.progressMessage,
      },
    });
  }
}
