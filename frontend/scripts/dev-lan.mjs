/* Запуск студии с доступом по сети.
 *
 * Обычный `npm run dev` слушает только localhost — с телефона или другого
 * компьютера туда не попасть. Здесь сервер слушает все интерфейсы, но сначала
 * проверяется пароль: API студии пишет файлы в проект, и без пароля открывать
 * его в сеть нельзя.
 *
 * Пароль задаётся в frontend/.env.local:  STUDIO_TOKEN=любая-длинная-строка
 */

import { spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const envFile = path.join(root, '.env.local');

/** Достаём STUDIO_TOKEN из окружения или из .env.local. */
function readToken() {
  if (process.env.STUDIO_TOKEN) return process.env.STUDIO_TOKEN;
  if (!existsSync(envFile)) return '';
  const line = readFileSync(envFile, 'utf8')
    .split(/\r?\n/)
    .find((l) => l.trim().startsWith('STUDIO_TOKEN='));
  return line ? line.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '') : '';
}

/** Адреса этой машины в локальной сети. */
function localAddresses() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((n) => n && n.family === 'IPv4' && !n.internal)
    .map((n) => n.address);
}

const token = readToken();

if (!token) {
  console.error(`
  Сначала задайте пароль студии.

  Откройте (или создайте) файл  frontend/.env.local  и добавьте строку:

      STUDIO_TOKEN=придумайте-длинный-пароль

  Без него API студии — а он пишет файлы прямо в проект — оказался бы
  открыт всем в сети. Запуск отменён.
`);
  process.exit(1);
}

const port = process.env.PORT || '3000';
const addresses = localAddresses();

console.log(`
  Верстак доступен по сети.

  С этого компьютера:   http://localhost:${port}/studio
${addresses.map((a) => `  С других устройств:    http://${a}:${port}/studio`).join('\n')}

  При первом входе с другого устройства студия спросит пароль из .env.local.
  Устройство должно быть в той же сети (тот же Wi-Fi).
`);

/* Запускаем сам файл Next через node. Через npx.cmd нельзя: свежий Node на
   Windows отказывается запускать .cmd без оболочки и падает с EINVAL. */
const nextBin = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next');

const child = spawn(
  process.execPath,
  [nextBin, 'dev', '--webpack', '-H', '0.0.0.0', '-p', port],
  { cwd: root, stdio: 'inherit', env: { ...process.env, STUDIO_TOKEN: token } },
);

child.on('exit', (code) => process.exit(code ?? 0));
