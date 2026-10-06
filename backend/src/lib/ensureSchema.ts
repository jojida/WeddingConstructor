import prisma from './prisma';
import fs from 'fs';
import path from 'path';

/* Добавочные колонки, которых может не быть в рабочей базе.

   Деплой миграции не запускает: схему прода ведут через `prisma db push`
   (см. DEPLOY.md), а автодеплой только собирает и перезапускает бэкенд.
   Без колонки Prisma падала бы на каждом запросе к таблице — поэтому новые
   колонки с дефолтом бэкенд дописывает сам при запуске, до первого запроса.
   Идемпотентно: колонка уже есть — ничего не делаем; `db push` потом тоже
   ничего не станет менять, определения совпадают со schema.prisma. */
const COLUMNS: { table: string; column: string; ddl: string }[] = [
  { table: 'GuestResponse', column: 'guestsCount', ddl: '"guestsCount" INTEGER NOT NULL DEFAULT 1' },
  { table: 'GuestResponse', column: 'attendance', ddl: `"attendance" TEXT NOT NULL DEFAULT ''` },
  { table: 'GuestResponse', column: 'childrenCount', ddl: '"childrenCount" INTEGER NOT NULL DEFAULT 0' },
  { table: 'GuestResponse', column: 'answers', ddl: `"answers" TEXT NOT NULL DEFAULT '[]'` },
];

/* Миграции, написанные идемпотентно (CREATE … IF NOT EXISTS): новые таблицы бэкенд
   создаёт сам при запуске. Комментарии вычищаем — операторы режутся по «;». */
const IDEMPOTENT_MIGRATIONS = ['20260928160000_print_orders', '20261006120000_planner'];

async function runMigration(dir: string): Promise<void> {
  const file = path.join(__dirname, '../../prisma/migrations', dir, 'migration.sql');
  const sql = fs.readFileSync(file, 'utf8').split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
  for (const statement of sql.split(';').filter((s) => s.trim())) await prisma.$executeRawUnsafe(statement);
}

export async function ensureSchema(): Promise<void> {
  // Сбой одной таблицы не должен лишать базу остальных: каждый шаг сам по себе.
  for (const dir of IDEMPOTENT_MIGRATIONS) {
    try { await runMigration(dir); }
    catch (e) { console.error(`Проверка схемы БД: миграция ${dir} не выполнена:`, e instanceof Error ? e.name : 'Error'); }
  }
  for (const c of COLUMNS) {
    const cols = await prisma.$queryRawUnsafe<{ name: string }[]>(`PRAGMA table_info("${c.table}")`);
    if (cols.some((x) => x.name === c.column)) continue;
    await prisma.$executeRawUnsafe(`ALTER TABLE "${c.table}" ADD COLUMN ${c.ddl}`);
    console.log(`🛠 База: добавлена колонка ${c.table}.${c.column}`);
  }
}
