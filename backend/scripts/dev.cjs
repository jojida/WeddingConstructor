const { spawn } = require('node:child_process');
const child = spawn(process.execPath, [require.resolve('ts-node-dev/lib/bin'), '--respawn', '--transpile-only', 'src/index.ts'], {
  stdio: 'inherit', env: { ...process.env, NODE_ENV: 'development' },
});
child.on('exit', code => process.exit(code ?? 1));
