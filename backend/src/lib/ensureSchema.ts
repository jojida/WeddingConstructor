import prisma from './prisma';

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

export async function ensureSchema(): Promise<void> {
  for (const c of COLUMNS) {
    const cols = await prisma.$queryRawUnsafe<{ name: string }[]>(`PRAGMA table_info("${c.table}")`);
    if (cols.some((x) => x.name === c.column)) continue;
    await prisma.$executeRawUnsafe(`ALTER TABLE "${c.table}" ADD COLUMN ${c.ddl}`);
    console.log(`🛠 База: добавлена колонка ${c.table}.${c.column}`);
  }
}
