const assert = require('node:assert/strict');
const { test } = require('node:test');
const { queryGitHubCliAdvisories } = require('../dist/services/securityService');

test('OSV only contributes active advisories for the mapped upstream package', async () => {
  const affected = [{ package: { name: 'github.com/cli/cli/v2', ecosystem: 'Go' } }];
  const findings = await queryGitHubCliAdvisories('2.1.0', async (url, options) => {
    assert.equal(url, 'https://api.osv.dev/v1/query');
    assert.deepEqual(JSON.parse(options.body), { package: affected[0].package, version: '2.1.0' });
    return Response.json({
      vulns: [
        { id: 'OSV-TEST-1', summary: 'Advisory fixture', affected },
        { id: 'OSV-TEST-2', withdrawn: '2026-01-01', affected },
        { id: 'OSV-TEST-3', affected: [{ package: { name: 'example.invalid/unrelated', ecosystem: 'Go' } }] },
      ],
    });
  });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].advisoryId, 'OSV-TEST-1');
  assert.equal(findings[0].affectedRange, '2.1.0');
  assert.equal(findings[0].severity, 'unknown');
});

test('unknown Windows package versions are never queried', async () => {
  const findings = await queryGitHubCliAdvisories('Unknown', () => assert.fail('unexpected advisory lookup'));
  assert.deepEqual(findings, []);
});
