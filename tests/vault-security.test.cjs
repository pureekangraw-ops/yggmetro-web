const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('ygg-vault-android/www/app.js', 'utf8');
function helper(name) {
  const expression = name === 'safeUrl' ? source.match(/function safeUrl\(value\)\{[^\n]+/)[0] : source.slice(source.indexOf('function validBackup(body){'), source.indexOf('$("#import").onchange='));
  const ctx = { URL, atob, Uint8Array };
  vm.runInNewContext(expression, ctx);
  return ctx[name];
}
test('Vault blocks script and data URLs', () => {
  const safeUrl = helper('safeUrl');
  for (const url of ['javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd', 'not a URL']) assert.equal(safeUrl(url), null);
  assert.equal(safeUrl('https://example.com/'), 'https://example.com/');
});
test('Vault backup rejects malformed encrypted payloads', () => {
  const validBackup = helper('validBackup');
  const b64 = bytes => Buffer.from(bytes).toString('base64');
  const good = { format:'YGG-VAULT-ENCRYPTED', version:1, salt:b64(Buffer.alloc(16)), payload:{version:1, iv:b64(Buffer.alloc(12)), ciphertext:b64(Buffer.alloc(16))} };
  assert.equal(validBackup(good), true);
  assert.equal(validBackup({...good, salt:'bad'}), false);
  assert.equal(validBackup({...good, payload:{...good.payload, iv:'bad'}}), false);
});
test('Vault escapes imported IDs in HTML attribute', () => {
  assert.match(source, /data-id="\$\{escapeHtml\(String\(e\.id\)\)\}"/);
});
