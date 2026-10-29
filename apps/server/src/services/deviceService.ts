import { prisma } from '../prisma';
import { AuditService } from './auditService';
import crypto from 'crypto';

export class DeviceService {
  static async pairDevice(data: {
    deviceName: string;
    osVersion: string;
    agentVersion: string;
    pairingToken?: string;
  }) {
    // Check if device already exists or generate a unique persistent device token
    let device = await prisma.device.findFirst({
      where: { name: data.deviceName },
    });

    const token = device?.token || `up_tok_${crypto.randomBytes(16).toString('hex')}`;

    if (device) {
      device = await prisma.device.update({
        where: { id: device.id },
        data: {
          osVersion: data.osVersion,
          agentVersion: data.agentVersion,
          lastSeen: new Date(),
          status: 'online',
          token,
        },
      });
    } else {
      device = await prisma.device.create({
        data: {
          name: data.deviceName,
          osVersion: data.osVersion,
          agentVersion: data.agentVersion,
          status: 'online',
          token,
        },
      });
    }

    await AuditService.record({
      actor: 'agent',
      deviceId: device.id,
      eventType: 'AGENT_PAIRED',
      target: device.name,
      metadata: { osVersion: data.osVersion, agentVersion: data.agentVersion },
    });

    return {
      deviceId: device.id,
      name: device.name,
      token: device.token,
      status: device.status,
    };
  }

  static async heartbeat(deviceId: string) {
    const device = await prisma.device.update({
      where: { id: deviceId },
      data: {
        lastSeen: new Date(),
        status: 'online',
      },
    });
    return device;
  }

  static async getDevices() {
    // Mark devices offline if no heartbeat in 60 seconds
    const threshold = new Date(Date.now() - 60000);
    await prisma.device.updateMany({
      where: {
        lastSeen: { lt: threshold },
        status: 'online',
      },
      data: { status: 'offline' },
    });

    return prisma.device.findMany({
      orderBy: { lastSeen: 'desc' },
      include: {
        _count: {
          select: { applications: true },
        },
      },
    });
  }

  static async revokeDevice(deviceId: string) {
    const device = await prisma.device.update({
      where: { id: deviceId },
      data: {
        status: 'unpaired',
        token: `revoked_${Date.now()}`,
      },
    });

    await AuditService.record({
      actor: 'user',
      deviceId,
      eventType: 'AGENT_REVOKED',
      target: device.name,
    });

    return device;
  }
}
