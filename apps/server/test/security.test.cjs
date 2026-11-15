const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  PairAgentSchema,
  DetectedAppSchema,
  ReportScanResultSchema,
  ExecuteUpdateSchema,
  UpdateJobResultSchema,
} = require('@updatepilot/shared');
const { openApiSpec } = require('../dist/openapi');
const { SUPPORTED_PACKAGES, queryPackageAdvisories } = require('../dist/services/securityService');

test('ExecuteUpdateSchema rejects command injection and malformed version strings', () => {
  const valid = { applicationId: 'app-uuid-1', targetVersion: '2.44.0', confirmedByUser: true };
  assert.equal(ExecuteUpdateSchema.safeParse(valid).success, true);

  // Command injection attempts
  const injections = [
    '2.44.0; rm -rf /',
    '2.44.0 & calc.exe',
    '2.44.0 | dir',
    '2.44.0`whoami`',
    '$(whoami)',
    '2.44.0\nmalicious_cmd',
    '../../etc/passwd',
    '2.44.0" && notepad.exe',
    ' ',
  ];

  for (const malicious of injections) {
    const parse = ExecuteUpdateSchema.safeParse({ ...valid, targetVersion: malicious });
    assert.equal(parse.success, false, `Should reject malicious targetVersion: ${malicious}`);
  }
});

test('ExecuteUpdateSchema enforces explicit user confirmation', () => {
  const unconfirmed = { applicationId: 'app-uuid-1', targetVersion: '2.44.0', confirmedByUser: false };
  const parse = ExecuteUpdateSchema.safeParse(unconfirmed);
  assert.equal(parse.success, false);
});

test('PairAgentSchema validates input parameters and bounds', () => {
  const valid = {
    deviceName: 'WIN11-WORKSTATION',
    osVersion: 'Windows 11 Pro 10.0.22631',
    agentVersion: '1.0.0',
    pairingCode: 'a'.repeat(32),
  };
  assert.equal(PairAgentSchema.safeParse(valid).success, true);

  // Missing required deviceName
  assert.equal(PairAgentSchema.safeParse({ ...valid, deviceName: '' }).success, false);
  // Extremely long pairing token beyond limit
  assert.equal(PairAgentSchema.safeParse({ ...valid, pairingCode: 'a'.repeat(200) }).success, false);
});

test('DetectedAppSchema sanitizes external URLs to strictly HTTPS', () => {
  const baseApp = {
    displayName: 'Test App',
    installedVersion: '1.0.0',
    source: 'winget',
    updateStatus: 'up_to_date',
  };

  // Valid HTTPS
  assert.equal(DetectedAppSchema.safeParse({
    ...baseApp,
    changelogUrl: 'https://github.com/example/app/releases',
    homepageUrl: 'https://example.com',
  }).success, true);

  // Insecure HTTP or javascript protocol
  assert.equal(DetectedAppSchema.safeParse({ ...baseApp, changelogUrl: 'http://insecure.test' }).success, false);
  assert.equal(DetectedAppSchema.safeParse({ ...baseApp, changelogUrl: 'javascript:alert(1)' }).success, false);
  assert.equal(DetectedAppSchema.safeParse({ ...baseApp, homepageUrl: 'file:///C:/Windows/System32' }).success, false);
});

test('UpdateJobResultSchema validates exit code and handles restartRequired', () => {
  const standardSuccess = {
    jobId: 'job-123',
    exitCode: 0,
    outputLogs: 'Successfully installed',
    verifiedInstalledVersion: '2.44.0',
    verificationPassed: true,
  };
  assert.equal(UpdateJobResultSchema.safeParse(standardSuccess).success, true);

  const rebootRequired = {
    jobId: 'job-123',
    exitCode: 3010,
    outputLogs: 'Success: Restart required',
    verifiedInstalledVersion: '2.44.0',
    verificationPassed: true,
    restartRequired: true,
  };
  const parsed = UpdateJobResultSchema.safeParse(rebootRequired);
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.restartRequired, true);
});

test('OpenAPI specification includes all essential MVP endpoints', () => {
  assert.equal(openApiSpec.openapi, '3.0.3');
  assert.ok(openApiSpec.paths['/dashboard']);
  assert.ok(openApiSpec.paths['/devices']);
  assert.ok(openApiSpec.paths['/devices/pair']);
  assert.ok(openApiSpec.paths['/devices/{id}/scans']);
  assert.ok(openApiSpec.paths['/scans/{id}']);
  assert.ok(openApiSpec.paths['/applications']);
  assert.ok(openApiSpec.paths['/applications/{id}']);
  assert.ok(openApiSpec.paths['/updates']);
  assert.ok(openApiSpec.paths['/updates/{id}/preview']);
  assert.ok(openApiSpec.paths['/updates/{id}/execute']);
  assert.ok(openApiSpec.paths['/jobs/{id}']);
  assert.ok(openApiSpec.paths['/jobs/{id}/cancel']);
  assert.ok(openApiSpec.paths['/history']);
  assert.ok(openApiSpec.paths['/reports/{kind}']);
  assert.ok(openApiSpec.paths['/security/findings']);
});

test('Security registry maps valid upstream packages with version constraints', () => {
  assert.ok(SUPPORTED_PACKAGES['GitHub.cli']);
  assert.ok(SUPPORTED_PACKAGES['Git.Git']);
  assert.equal(SUPPORTED_PACKAGES['GitHub.cli'].versionPattern.test('2.43.0'), true);
  assert.equal(SUPPORTED_PACKAGES['GitHub.cli'].versionPattern.test('malicious'), false);
});

