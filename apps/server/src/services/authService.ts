import crypto from 'node:crypto';
import { prisma } from '../prisma';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, key] = stored.split(':');
  if (!salt || !key) return false;
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(key, 'hex'));
}

export function generatePairingCode(): string {
  const code = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `UP-${code.slice(0, 4)}-${code.slice(4)}`;
}

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

    // If this is the first registered user, associate any existing unowned devices (e.g. host PC)
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

    // Ensure user has a pairing code
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
    const user = await prisma.user.findUnique({
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
    return user;
  }

  static async getUserByPairingCode(code: string) {
    const normalized = code.trim().toUpperCase();
    return prisma.user.findFirst({
      where: { pairingCode: normalized },
    });
  }

  static async ensureDefaultAdmin() {
    const count = await prisma.user.count();
    if (count === 0) {
      const email = 'admin@updatepilot.local';
      const password = process.env.DASHBOARD_PASSWORD || 'adminpassword123';
      const name = 'Admin';
      const pairingCode = 'UP-ADMIN-DEFAULT';
      const passwordHash = hashPassword(password);

      const user = await prisma.user.create({
        data: {
          email,
          name,
          passwordHash,
          role: 'admin',
          pairingCode,
        },
      });

      // Link any existing devices to admin
      await prisma.device.updateMany({
        where: { ownerId: null },
        data: { ownerId: user.id },
      });

      return user;
    }
    return null;
  }
}
