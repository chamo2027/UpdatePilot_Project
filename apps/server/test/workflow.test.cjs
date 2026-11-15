const assert = require('node:assert/strict');
const { once } = require('node:events');
const { mkdtempSync, readdirSync, unlinkSync, rmdirSync } = require('node:fs');
const { basename, join } = require('node:path');
const { execFile, spawn, spawnSync } = require('node:child_process');
const { promisify } = require('node:util');
const { setTimeout: delay } = require('node:timers/promises');
const { test } = require('node:test');

const liveScan = process.env.UPDATEPILOT_LIVE_SCAN === '1';
const browserSmoke = process.env.UPDATEPILOT_BROWSER_SMOKE === '1';

test('dashboard access, agent pairing and exact update verification', { timeout: liveScan || browserSmoke ? 180_000 : 60_000 }, async () => {
  const dir = mkdtempSync(join(process.cwd(), 'prisma', '.test-'));
  const origin = browserSmoke ? 'http://127.0.0.1:3210' : 'http://localhost:3000';
  const password = 'test-only-password';
  const pairingCode = 'test-only-pairing-code-000000';
  const env = {
    ...process.env,
    DATABASE_URL: 'file:./' + basename(dir) + '/test.db',
    PORT: browserSmoke ? '4000' : '0',
    DASHBOARD_PASSWORD: password,
    SESSION_SECRET: 'test-only-session-secret-for-integration',
    DASHBOARD_ORIGIN: origin,
    AGENT_PAIRING_CODE: pairingCode,
    ENABLE_OSV_ADVISORIES: 'false',
    SCAN_INTERVAL_MINUTES: '0',
  };
  let server;
  try {
    for (const expected of [/All migrations have been successfully applied/, /No pending migrations/]) {
      const migration = spawnSync(process.execPath, ['prisma/migrate.cjs'], { env, encoding: 'utf8', timeout: 15_000 });
      assert.equal(migration.status, 0, migration.stderr);
      assert.match(migration.stdout, expected);
    }
    server = spawn(process.execPath, ['dist/index.js'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    server.stdout.on('data', chunk => { output += chunk; });
    server.stderr.on('data', chunk => { output += chunk; });
    let port;
    for (let attempt = 0; attempt < 100 && !port && server.exitCode === null; attempt++) {
      await delay(100);
      port = output.match(/API listening on http:\/\/localhost:(\d+)/)?.[1];
    }
    assert.ok(port, output);
    let cookie;
    const request = async (path, status, { body, token, dashboard = false, requestOrigin = origin } = {}) => {
      const headers = { Origin: requestOrigin };
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      if (token) headers.Authorization = 'Bearer ' + token;
      if (dashboard && cookie) headers.Cookie = cookie;
      const response = await fetch('http://127.0.0.1:' + port + '/api/v1' + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(5000),
      });
      const payload = await response.json().catch(() => ({}));
      assert.equal(response.status, status, path + ' ' + JSON.stringify(payload));
      if (path === '/session' && status === 200) cookie = response.headers.get('set-cookie').split(';')[0];
      return payload.data;
    };

    await request('/dashboard', 401);
    await request('/session', 401, { body: { password: 'incorrect' } });
    await request('/session', 200, { body: { password } });
    await request('/dashboard', 200, { dashboard: true });
    const deviceInfo = { deviceName: 'Test PC', osVersion: 'Windows', agentVersion: 'test' };
    await request('/devices/pair', 403, { body: deviceInfo });
    const first = await request('/devices/pair', 200, { body: { ...deviceInfo, pairingCode } });
    const second = await request('/devices/pair', 200, { body: { ...deviceInfo, pairingCode } });
    assert.notEqual(first.deviceId, second.deviceId);
    const devices = await request('/devices', 200, { dashboard: true });
    assert.ok(devices.every(device => !Object.hasOwn(device, 'token')));
    await request('/agent/jobs/pending?deviceId=' + first.deviceId, 401);

    const scan = await request('/agent/scans', 202, { token: first.token, body: {} });
    const scanBody = {
      deviceId: first.deviceId, scanJobId: scan.id, applications: [{
        displayName: 'Example', packageId: 'Example.App', source: 'winget',
        installedVersion: '1.0', availableVersion: '2.0', updateStatus: 'update_available',
      }],
    };
    await request('/agent/scans/report', 404, { token: second.token, body: scanBody });
    await request('/agent/scans/report', 200, { token: first.token, body: scanBody });
    const [app] = await request('/reports/inventory', 200, { dashboard: true });
    if (browserSmoke) await require('./browser-smoke.cjs').checkDashboard(origin, password);
    const update = '/updates/' + app.id + '/execute';
    const approval = { applicationId: app.id, targetVersion: '2.0', confirmedByUser: true };
    await request(update, 401, { body: approval });
    await request(update, 403, { dashboard: true, body: approval, requestOrigin: 'http://other.invalid' });
    await request(update, 400, { dashboard: true, body: { ...approval, confirmedByUser: false } });
    await request(update, 400, { dashboard: true, body: { ...approval, targetVersion: '3.0' } });
    const cancelled = await request(update, 202, { dashboard: true, body: approval });
    const cancelResult = await request('/jobs/' + cancelled.id + '/cancel', 200, { dashboard: true, body: {} });
    assert.equal(cancelResult.state, 'cancelled');
    assert.equal(await request('/agent/jobs/pending', 200, { token: first.token }), null);
    for (const [observed, expected] of [['1.0', 'failed'], ['2.0', 'succeeded']]) {
      const queued = await request(update, 202, { dashboard: true, body: approval });
      const claimed = await request('/agent/jobs/pending', 200, { token: first.token });
      assert.equal(claimed.job.id, queued.id);
      assert.equal(claimed.job.targetVersion, '2.0');
      const report = {
        jobId: queued.id, exitCode: 0, outputLogs: 'Test fixture',
        verifiedInstalledVersion: observed, verificationPassed: true,
      };
      await request('/agent/updates/report', 404, { token: second.token, body: report });
      const result = await request('/agent/updates/report', 200, { token: first.token, body: report });
      assert.equal(result.state, expected);
    }
    await request('/devices/' + first.deviceId + '/revoke', 200, { dashboard: true, body: {} });
    await request('/agent/jobs/pending', 401, { token: first.token });
    await request('/devices/pair', 403, { body: { ...deviceInfo, pairingToken: first.token } });
    if (liveScan) {
      const bundle = join(__dirname, '..', '..', 'agent', 'dist', 'windows', 'updatepilot-agent.cjs');
      await promisify(execFile)(process.execPath, [bundle, '--once'], {
        cwd: dir,
        timeout: 160_000,
        env: { ...env, SERVER_URL: 'http://127.0.0.1:' + port + '/api/v1' },
      });
      const inventory = await request('/reports/inventory', 200, { dashboard: true });
      const liveApps = inventory.filter(app => ![first.deviceId, second.deviceId].includes(app.deviceId));
      assert.ok(liveApps.length, 'The live Windows agent should submit a non-empty inventory.');
      console.log('Packaged Windows agent reported ' + liveApps.length + ' live applications.');
    }
  } finally {
    if (server && server.exitCode === null) {
      const exited = once(server, 'exit');
      server.kill();
      await exited;
    }
    for (const file of readdirSync(dir)) unlinkSync(join(dir, file));
    rmdirSync(dir);
  }
});
