import dotenv from 'dotenv';
import { AgentClient } from './agentClient';

dotenv.config();

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:4000/api/v1';
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL_MS || '5000', 10);
const isRunOnce = process.argv.includes('--once');

async function main() {
  console.log('====================================================');
  console.log('   UpdatePilot - Windows Host Agent v1.0.0');
  console.log('====================================================');

  const client = new AgentClient(SERVER_URL);

  const paired = await client.pair();
  if (!paired) {
    console.error('[Agent] Could not pair with server. Ensure backend is running.');
    if (isRunOnce) process.exit(1);
  }

  // Initial scan on launch
  await client.runScan();

  if (isRunOnce) {
    console.log('[Agent] Run-once scan finished. Exiting.');
    process.exit(0);
  }

  console.log(`[Agent] Polling for jobs and sending heartbeats every ${POLL_INTERVAL / 1000}s...`);

  // Periodic heartbeat & job poll loop
  setInterval(async () => {
    await client.heartbeat();
    await client.pollJobs();
  }, POLL_INTERVAL);
}

main().catch((err) => {
  console.error('[Agent] Fatal error:', err);
  process.exit(1);
});
