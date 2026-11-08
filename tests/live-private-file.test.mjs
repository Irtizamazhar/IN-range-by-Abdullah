import test from 'node:test';
import assert from 'node:assert/strict';
import { securePrivateFile } from '../scripts/lib/live-private-file.mjs';
test('Windows private output receives an owner-only ACL without shell interpolation of the path', () => {
  let invoked = false;
  securePrivateFile('C:\\private fixture\\backup.sql', 'win32', (binary, args, options) => {
    invoked = true; assert.equal(binary, 'powershell.exe');
    assert.ok(args[2].includes('SetAccessRuleProtection($true,$false)'));
    assert.ok(!args.join(' ').includes('private fixture'));
    assert.equal(options.env.JORO_PRIVATE_OUTPUT_FILE, 'C:\\private fixture\\backup.sql');
    return { status: 0 };
  });
  assert.equal(invoked, true);
});
test('ACL failure stops before data is written', () => {
  assert.throws(() => securePrivateFile('fixture.sql', 'win32', () => ({ status: 1 })), /No private data was written/);
});
