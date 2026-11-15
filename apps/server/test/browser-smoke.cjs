const assert = require('node:assert/strict');
const { once } = require('node:events');
const { spawn } = require('node:child_process');
const { join } = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');

async function checkDashboard(origin, password) {
  const { chromium } = require(process.env.UPDATEPILOT_PLAYWRIGHT_PATH || 'playwright');
  const web = spawn(process.execPath, [
    require.resolve('next/dist/bin/next'), 'start', '-H', '127.0.0.1', '-p', new URL(origin).port,
  ], { cwd: join(__dirname, '..', '..', 'web'), stdio: ['ignore', 'pipe', 'pipe'] });
  let browser;
  let output = '';
  web.stdout.on('data', chunk => { output += chunk; });
  web.stderr.on('data', chunk => { output += chunk; });
  try {
    for (let retry = 0; retry < 100 && !output.includes('Ready') && web.exitCode === null; retry++) {
      await delay(100);
    }
    assert.ok(output.includes('Ready'), output);
    browser = await chromium.launch({
      headless: true, executablePath: process.env.UPDATEPILOT_CHROMIUM_PATH || undefined,
    });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.setDefaultTimeout(8000);
    await page.goto(origin);
    await page.getByLabel('Dashboard password').fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.locator('#nav-applications').click();
    await page.getByRole('heading', { name: 'Application Inventory' }).waitFor();
    await page.getByLabel('Search applications').fill('Example');
    await page.getByLabel('Sort applications').selectOption('name_desc');
    await page.getByRole('button', { name: 'Update', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Safe Update Confirmation' });
    await dialog.getByRole('checkbox').waitFor();
    assert.equal(await dialog.getByRole('checkbox').isChecked(), false);
    assert.equal(await dialog.getByRole('button', { name: 'Confirm & Update' }).isDisabled(), true);
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.getByRole('heading', { name: 'Application Inventory' }).isVisible(), true);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      'Dashboard must fit a narrow viewport without scrolling the whole page horizontally.');
    console.log('Browser sign-in, inventory, update preview, keyboard dismissal and narrow layout passed.');
  } finally {
    await browser?.close();
    if (web.exitCode === null) {
      const exited = once(web, 'exit');
      web.kill();
      await exited;
    }
  }
}

module.exports = { checkDashboard };
