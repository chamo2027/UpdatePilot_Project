import crypto from 'node:crypto';
import { prisma } from '../prisma';
import { AuditService } from './auditService';
import { AuthService } from './authService';
import { hashSecret, sameSecret } from '../access';

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

    if (!existing) {
      // 1. Match user-specific pairing code (from User.pairingCode)
      if (data.pairingCode) {
        const matchedUser = await AuthService.getUserByPairingCode(data.pairingCode);
        if (matchedUser) {
          ownerId = matchedUser.id;
        }
      }

      // 2. Global pairing code fallback
      const globalCode = process.env.AGENT_PAIRING_CODE;
      if (!ownerId && globalCode && globalCode.length >= 24 && data.pairingCode && sameSecret(data.pairingCode, globalCode)) {
        const adminUser = await prisma.user.findFirst({ where: { role: 'admin' } });
        ownerId = adminUser ? adminUser.id : null;
      }

      if (!ownerId) {
        throw new Error('Invalid pairing credentials.');
      }
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
      await AuditService.record({ actor: 'agent', deviceId: device.id, eventType: 'AGENT_PAIRED', target: device.name, metadata });
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
