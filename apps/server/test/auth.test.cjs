const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

// Import built dist or directly test crypto logic
const { hashPassword, verifyPassword, generatePairingCode } = require('../dist/services/authService.js');

test('AuthService correctly hashes and verifies passwords using scrypt', () => {
  const password = 'SuperSecretPassword123!';
  const hashed = hashPassword(password);
  
  assert.ok(hashed.includes(':'), 'Hash must contain salt:hash delimiter');
  assert.ok(verifyPassword(password, hashed), 'Valid password must verify true');
  assert.ok(!verifyPassword('WrongPassword', hashed), 'Invalid password must verify false');
  assert.ok(!verifyPassword('', hashed), 'Empty password must verify false');
});

test('AuthService generates valid unique pairing codes with prefix UP-', () => {
  const code1 = generatePairingCode();
  const code2 = generatePairingCode();

  assert.match(code1, /^UP-[0-9A-F]{4}-[0-9A-F]{4}$/, 'Pairing code must match UP-XXXX-XXXX format');
  assert.notEqual(code1, code2, 'Subsequent pairing codes must be distinct');
});
