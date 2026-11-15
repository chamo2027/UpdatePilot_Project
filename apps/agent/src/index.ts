import dotenv from 'dotenv';
import { AgentClient } from './agentClient';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SERVER_URL = process.env.SERVER_URL || 'http://127.0.0.1:4000/api/v1';
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL_MS || '5000', 10);
const scanIntervalMinutes = Number(process.env.SCAN_INTERVAL_MINUTES || 0);
const isRunOnce = process.argv.includes('--once');

async function main() {
  console.log('====================================================');
  console.log('   UpdatePilot - Windows Host Agent v1.0.0');
  console.log('====================================================');

  const client = new AgentClient(SERVER_URL);

  const paired = await client.pair();
  if (!paired) {
    console.error('[Agent] Could not pair with server. Ensure backend is running.');
    process.exit(1);
  }

  // Initial scan on launch
  const scanned = await client.runScan();

  if (isRunOnce) {
    console.log('[Agent] Run-once scan finished. Exiting.');
    process.exit(scanned ? 0 : 1);
  }

  console.log(`[Agent] Polling for jobs and sending heartbeats every ${POLL_INTERVAL / 1000}s...`);

  // Periodic heartbeat & job poll loop
  let polling = false;
  const scheduledScan = Number.isSafeInteger(scanIntervalMinutes) && scanIntervalMinutes >= 5 && scanIntervalMinutes <= 10_080;
  let nextScanAt = Date.now() + scanIntervalMinutes * 60_000;
  const processJobs = async () => {
    await client.pollJobs();
    if (scheduledScan && Date.now() >= nextScanAt) {
      nextScanAt = Date.now() + scanIntervalMinutes * 60_000;
      await client.runScan();
    }
  };
  setInterval(() => {
    void client.heartbeat();
    if (polling) return;
    polling = true;
    void processJobs().catch(console.error).finally(() => { polling = false; });
  }, POLL_INTERVAL);
}

main().catch((err) => {
  console.error('[Agent] Fatal error:', err);
  process.exit(1);
});
