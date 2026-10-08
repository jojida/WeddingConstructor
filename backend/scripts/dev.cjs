const { spawn } = require('node:child_process');
const child = spawn(process.execPath, [require.resolve('tsx/cli'), 'watch', 'src/index.ts'], {
  stdio: 'inherit', env: { ...process.env, NODE_ENV: 'development' },
});
child.on('exit', code => process.exit(code ?? 1));
child.on('error', () => { console.error('Не удалось запустить сервер разработки'); process.exitCode = 1; });
