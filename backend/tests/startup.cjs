const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

test('schema failure stops startup without logging database or credential details', () => {
  const root = path.resolve(__dirname, '..');
  const tmpRoot = path.join(root, '.test-tmp');
  fs.mkdirSync(tmpRoot, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(tmpRoot, 'startup-'));
  try {
    const env = { ...process.env, NODE_ENV: 'test', JWT_SECRET: 'test-startup-secret-at-least-32-bytes',
      PORT: '0', DATABASE_URL: `file:${path.join(tmp, 'missing', 'private-database.db').replace(/\\/g, '/')}`,
      TELEGRAM_BOT_TOKEN: '', TELEGRAM_BOT_USERNAME: '' };
    const result = spawnSync(process.execPath, ['dist/index.js'], { cwd: root, env, encoding: 'utf8', timeout: 15000 });
    assert.ifError(result.error);
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stdout, /API running/);
    assert.match(result.stderr, /API не запущен/);
    assert.doesNotMatch(result.stderr, /private-database|test-startup-secret|PrismaClient/);
  } finally { assert.equal(path.dirname(tmp), tmpRoot); fs.rmSync(tmp, { recursive: true }); }
});
