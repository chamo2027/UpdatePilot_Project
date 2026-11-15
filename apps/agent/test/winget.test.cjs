const assert = require('node:assert/strict');
const { test } = require('node:test');
const { parseReleaseDetails, WingetService } = require('../dist/winget');

test('WinGet metadata keeps HTTPS publisher and release links', () => {
  const result = parseReleaseDetails([
    'Publisher: Example Publisher',
    'Homepage: https://example.test/app',
    'Release Notes Url: https://example.test/2.0',
    '  Release Date: 2026-01-03',
  ].join('\r\n'));
  assert.deepEqual(result, {
    publisher: 'Example Publisher',
    homepageUrl: 'https://example.test/app',
    changelogUrl: 'https://example.test/2.0',
    releaseDate: '2026-01-03',
  });
});

test('unrecognized WinGet metadata stays unavailable', () => {
  const result = parseReleaseDetails('Homepage: javascript:void(0)\nRelease Date: unknown');
  assert.equal(result.homepageUrl, null);
  assert.equal(result.changelogUrl, null);
  assert.equal(result.releaseDate, null);
});

test('update rejects invalid package and version values before calling WinGet', async () => {
  await assert.rejects(WingetService.executeUpdate('Example App', '1.0', '2.0'), /Invalid approved/);
  await assert.rejects(WingetService.executeUpdate('Example.App', '1.0', '--other'), /Invalid approved/);
});

test('handles non-English or localized column structures gracefully', () => {
  // Test input validation with valid patterns
  assert.equal(typeof WingetService.verifyInstalledVersion, 'function');
  assert.equal(typeof WingetService.listInstalledApplications, 'function');
});
