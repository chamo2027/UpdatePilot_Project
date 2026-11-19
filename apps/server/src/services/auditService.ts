import { prisma } from '../prisma';

export class AuditService {
  static async record(params: {
    actor?: string;
    deviceId?: string | null;
    eventType: string;
    target: string;
    metadata?: Record<string, any>;
  }) {
    return prisma.auditEvent.create({
      data: {
        actor: params.actor || 'system',
        deviceId: params.deviceId,
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
