const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  module._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, filename);
};
const { denyAccess } = require('../src/studio/server/paths.ts');
const { publicIPv4, fetchPublic } = require('../src/studio/server/fetchPublic.ts');

test('studio requires a token, rejects cross-origin requests and stays disabled in production', () => {
  process.env.NODE_ENV = 'development';
  delete process.env.STUDIO_TOKEN;
  const request = (headers = {}) => new Request('http://localhost:3000/api/studio/projects', { headers });
  assert.equal(denyAccess(request()).status, 401);
  process.env.STUDIO_TOKEN = 'test-studio-token';
  assert.equal(denyAccess(request({ 'x-studio-token': 'test-studio-token' })), null);
  assert.equal(denyAccess(request({ 'x-studio-token': 'test-studio-token', origin: 'https://evil.example' })).status, 403);
  assert.equal(denyAccess(request({ cookie: 'wc_studio_token=%E0%A4%A' })).status, 401);
  process.env.NODE_ENV = 'production';
  assert.equal(denyAccess(request({ 'x-studio-token': 'test-studio-token' })).status, 404);
});

test('studio proxy blocks private/reserved IPs and unsafe URL schemes', async () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '::1']) assert.equal(publicIPv4(ip), false, ip);
  assert.equal(publicIPv4('93.184.216.34'), true);
  await assert.rejects(fetchPublic(new URL('file:///etc/passwd')));
  await assert.rejects(fetchPublic(new URL('http://user:pass@example.com')));
  await assert.rejects(fetchPublic(new URL('http://example.com:8080')));
});

test('all invitation runtimes reject executable links and attribute injection', () => {
  for (const name of ['script.js', 'calla/script.js', 'floral/script.js', 'garden-arch/script.js', 'sketch/script.js', 'vadimdarya/script.js', 'assets/studio-runtime.js']) {
    const filename = path.join(__dirname, '../public/invite', name);
    const source = fs.readFileSync(filename, 'utf8');
    // Parse the actual runtime functions; exercise malicious persisted field values.
    const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const functions = [];
    const visit = node => {
      if (ts.isFunctionDeclaration(node) && ['safeHref', 'imageUrl'].includes(node.name?.text)) functions.push(node.getText(ast));
      ts.forEachChild(node, visit);
    };
    visit(ast);
    assert.equal(functions.length, 2, name);
    const context = { URL, window: { location: { href: 'https://weddingcraft.ru/invite/calla/' } }, STATE: { apiBase: '' } };
    vm.createContext(context);
    vm.runInContext(functions.join('\n'), context);
    assert.equal(context.safeHref('javascript:alert(1)'), '#', name);
    assert.equal(context.safeHref('java\nscript:alert(1)'), '#', name);
    assert.equal(context.safeHref('https://example.com/map'), 'https://example.com/map', name);
    assert.equal(context.imageUrl('x" onerror="alert(1)'), '', name);
    assert.equal(context.imageUrl('data:text/html,payload'), '', name);
    assert.equal(context.imageUrl('/uploads/test.png'), '/uploads/test.png', name);
    assert.match(source, /e\.origin !== window\.location\.origin \|\| e\.source !== window\.parent/, name);
    new vm.Script(source, { filename });
  }
});
