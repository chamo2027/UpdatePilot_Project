import { prisma } from '../prisma';
import { Application, DashboardMetrics } from '@updatepilot/shared';
import { AuditService } from './auditService';
import { SecurityService } from './securityService';

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
      updateStatus: 'up_to_date' | 'update_available' | 'unknown' | 'unsupported';
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
      let updatesFound = 0;

      for (const app of applications) {
        if (app.updateStatus === 'update_available') {
          updatesFound++;
        }

        // Upsert application record
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

        // If availableVersion and packageId are present, record release metadata
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

      // Update scan job record
      await tx.scanJob.update({
        where: { id: scanJobId },
        data: {
          state: 'completed',
          totalApps: applications.length,
          updatesFound,
          inventorySnapshot: JSON.stringify(applications),
        },
      });
      return updatesFound;
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
        { displayName: { contains: q } },
        { packageId: { contains: q } },
        { publisher: { contains: q } },
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
      securityFindings: await SecurityService.getFindings(id),
    };
  }

  static async getAvailableUpdates(deviceId?: string) {
    const where: any = {
      updateStatus: 'update_available',
    };
    if (deviceId) {
      where.deviceId = deviceId;
    }

    const apps = await prisma.application.findMany({
      where,
      orderBy: { displayName: 'asc' },
      include: {
        device: { select: { id: true, name: true } },
      },
    });

    return apps;
  }

  static async getDashboardMetrics(): Promise<DashboardMetrics> {
    const [
      totalApplications,
      updatesAvailable,
      upToDate,
      unsupportedOrUnknown,
      activeDevices,
      lastScanJob,
    ] = await Promise.all([
      prisma.application.count(),
      prisma.application.count({ where: { updateStatus: 'update_available' } }),
      prisma.application.count({ where: { updateStatus: 'up_to_date' } }),
      prisma.application.count({
        where: { updateStatus: { in: ['unknown', 'unsupported'] } },
      }),
      prisma.device.count({ where: { status: 'online' } }),
      prisma.scanJob.findFirst({
        where: { state: 'completed' },
        orderBy: { completedAt: 'desc' },
      }),
    ]);

    const primaryDevice = await prisma.device.findFirst({
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
