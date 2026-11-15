const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });
dotenv.config();
if (process.env.DATABASE_URL !== 'file:./demo.db') {
  throw new Error('Demo data can only be written to DATABASE_URL=file:./demo.db.');
}

const prisma = new PrismaClient();
async function seed() {
  await prisma.$transaction(async tx => {
    const device = await tx.device.upsert({
      where: { id: 'demo-device' },
      update: {},
      create: {
        id: 'demo-device', name: '[Demo] Sample Windows PC', osVersion: 'Example Windows 11',
        agentVersion: 'Demo fixture', status: 'unpaired', token: 'demo-device-disabled',
      },
    });
    for (const [id, displayName, installedVersion] of [
      ['demo-editor', '[Demo] Example editor', '1.2.0'],
      ['demo-reader', '[Demo] Example reader', '3.1.0'],
    ]) {
      await tx.application.upsert({
        where: { id }, update: {},
        create: { id, deviceId: device.id, displayName, installedVersion, source: 'demo', updateStatus: 'unsupported' },
      });
    }
  });
}

seed().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
