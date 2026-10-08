// Read-only: prints paths/rule names, never matching credentials or file contents.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
const issues = [];
const rules = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ['github-token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/],
  ['openai-key', /\bsk-proj-[A-Za-z0-9_-]{30,}\b/],
  ['telegram-token', /\b\d{7,12}:[A-Za-z0-9_-]{35}\b/],
  ['aws-access-key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
];
for (const file of tracked) {
  if (/(?:^|\/)(?:\.env(?:\..+)?|id_rsa|id_ed25519)$/.test(file) && !file.endsWith('.example')) {
    issues.push({ file, rule: 'tracked-secret-file' });
  }
  if (/\.(?:db|sqlite|sqlite3)(?:-(?:wal|shm|journal))?$/i.test(file) || file.startsWith('backend/uploads/')) {
    issues.push({ file, rule: 'tracked-runtime-data' });
    continue;
  }
  if (!/\.(?:[cm]?[jt]sx?|json|md|ya?ml|toml|ini|config|sh|ps1|html|txt|sql)$/i.test(file)) continue;
  const filename = path.join(root, file);
  if (!fs.existsSync(filename) || fs.statSync(filename).size > 2 * 1024 * 1024) continue;
  const content = fs.readFileSync(filename, 'utf8');
  for (const [rule, pattern] of rules) if (pattern.test(content)) issues.push({ file, rule });
}
console.log(JSON.stringify({ trackedFiles: tracked.length, findings: issues }, null, 2));
process.exitCode = issues.length ? 1 : 0;
