# ✦ WeddingCraft — конструктор сайтов-приглашений на свадьбу

Прод: **weddingcraft.ru** (фронт) + **api.weddingcraft.ru** (бэкенд).
Модель: **разовая оплата за один готовый сайт**, без подписок и сроков.

| Тариф | Цена | Что входит |
|-------|------|------------|
| Базовый | 3 990 ₽ | сайт-приглашение, RSVP-анкета, уведомления в Telegram/Email, фоновая музыка, адрес на нашем домене |
| Премиум | 5 990 ₽ | всё из Базового + кабинет гостей, персональные ссылки с обращением, ответы по каждому гостю, свой домен |

## Структура

```
WeddingConstructor/
├── backend/            Express + Prisma (SQLite) — API
├── frontend/           Next.js 16 (App Router) — сайт, редактор, кабинет
│   └── public/invite/  СТАТИЧНЫЕ шаблоны приглашений (HTML+CSS+JS)
├── DEPLOY.md           деплой на VPS (nginx + certbot + pm2)
└── MARKETING_PLAN.md   план запуска и каналы
```

## Быстрый старт

```bash
cd backend  && npm run dev     # http://localhost:4000
cd frontend && npm run dev     # http://localhost:3000
```

БД создаётся автоматически: `backend/prisma/dev.db`.

## Как устроены шаблоны (главное)

Шаблон — это **самостоятельный статический сайт** в `frontend/public/invite/<id>/`
(HTML + CSS + `script.js`), перенесённый из Canva пиксель-в-пиксель. React его не
перерисовывает, а монтирует в `<iframe>` и передаёт данные:

* первый рендер — через URL-параметры (`?groom=&bride=&date=`);
* живое превью в редакторе — `postMessage({type:'wc:data'})`, шаблон отвечает `wc:ready`;
* точки подстановки в HTML помечены `data-edit="ключ"`, `script.js` подставляет
  тексты, фото, палитру, программу дня, список напитков;
* какие поля показать в редакторе, описывает `TEMPLATE_FIELDS` в
  `frontend/src/lib/constants.ts` — **id поля равен `data-edit`-ключу**;
* общие модули шаблонов лежат в `public/invite/assets/` (`music.js` — фоновая мелодия).

Дизайн не редактируется — пара меняет только текст, фото и цвета.

### Шесть живых шаблонов

`calla` (Каллы) · `sketch` (Скетч) · `floral` (Флоральный) ·
`garden-arch` (Цветущая арка) · `mediterranean` (Средиземноморье) ·
`vadimdarya` (Тёмная элегантность)

Старые React-шаблоны (`classic`, `nautical`, `video`…) — архив, `_TEMPLATES_LEGACY`.

## Страницы

| URL | Описание |
|-----|----------|
| `/` | Лендинг |
| `/templates` | Галерея шаблонов |
| `/demo/[templateId]` | Живое демо шаблона |
| `/editor?template=…` | Редактор (работает **без регистрации**, черновик в localStorage) |
| `/auth` | Вход по коду на email (без пароля) |
| `/dashboard`, `/dashboard/[id]` | Кабинет: ответы, гости, уведомления, домен |
| `/payment`, `/payment/success` | Тариф и оплата (ЮKassa) |
| `/[slug]` | Готовый сайт пары (`weddingcraft.ru/ivan-i-anna`) |
| `/oferta`, `/privacy` | Оферта и политика — обязательны для ЮKassa |

## API

| Метод | URL | Описание |
|-------|-----|----------|
| POST | `/api/auth/send-code` · `/verify-code` | вход по коду на email |
| GET/POST/PUT/DELETE | `/api/invites…` | черновики (PUT → 403 после публикации) |
| GET | `/api/invites/by-slug/:slug` · `by-domain/:host` | публичный сайт (402, если не оплачен) |
| PATCH | `/api/invites/:id/slug` · `/settings` | адрес сайта, уведомления, свой домен |
| POST | `/api/upload/image` · `/gallery` · `/audio` | фото и фоновая мелодия |
| POST/GET | `/api/rsvp/:slug` · `/api/rsvp/:invitationId` | анкета гостя и статистика |
| GET/POST | `/api/guests…` | список гостей и персональные ссылки (Премиум) |
| POST | `/api/payment/create` · `/webhook` | ЮKassa API v3 |
| GET | `/api/payment/status/:inviteId` · `/promo/:code` | статус оплаты, промокод |
| GET | `/api/domains/check` · `/status/:inviteId` | привязка своего домена |

## Оплата

ЮKassa API v3. Уведомления не подписаны, поэтому вебхук берёт из тела только id
и **перечитывает платёж из API**; страница успеха дополнительно опрашивает
`/api/payment/status/:id`. Ключи — в `backend/.env` (`YOOKASSA_SHOP_ID`,
`YOOKASSA_SECRET_KEY`). Без ключей: в проде — 503, в dev — авто-approve.

Промокоды задаются переменной окружения без деплоя:
`PROMO_CODES="СВАДЬБА10:10,PARTNER-IRA:15"`.

## Перед приёмом платежей

1. Заполнить `LEGAL` в `frontend/src/lib/constants.ts` (ФИО и ИНН) — их печатают
   `/oferta` и `/privacy`, без них ЮKassa не пройдёт модерацию.
2. Ключи ЮKassa + `NODE_ENV=production` + ротация `JWT_SECRET` на сервере.
3. Вебхук `payment.succeeded` → `https://api.weddingcraft.ru/api/payment/webhook`.

Подробности — в [DEPLOY.md](DEPLOY.md).
