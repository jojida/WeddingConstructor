# Деплой WeddingConstructor на VPS

## Сервер
- IP: 89.191.226.237
- OS: Ubuntu 24.04 LTS
- RAM: 1 GB + 2 GB swap
- Диск: 14 GB (3.5 GB свободно)
- VPN: IKEv2 (UDP 500/4500 — не конфликтует)

## DNS на reg.ru
Домен: `weddingcraft.ru`

| Тип | Хост | Значение |
|-----|------|----------|
| A | `@` | `89.191.226.237` |
| A | `www` | `89.191.226.237` |
| A | `api` | `89.191.226.237` |

## Установка зависимостей (уже сделано)
```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs

# Caddy
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy

# PM2
npm install -g pm2
```

## Клонирование (уже сделано)
```bash
git clone https://github.com/jojida/WeddingConstructor.git /var/www/wedding
```

## Бэкенд (уже сделано)
```bash
cd /var/www/wedding/backend
npm install
npx prisma generate && npx prisma db push
npm run build
```

### .env (уже создан)
```
DATABASE_URL="file:./prisma/prod.db"
JWT_SECRET="<случайная строка>"
FRONTEND_URL="https://weddingcraft.ru"
YOOMONEY_SHOP_ID=""
YOOMONEY_SECRET_KEY=""
TELEGRAM_BOT_TOKEN=""
TELEGRAM_BOT_USERNAME=""
```

## Запуск бэкенда
```bash
cd /var/www/wedding/backend
pm2 start dist/index.js --name wedding-api
pm2 save
pm2 startup
```

## Фронтенд
```bash
cd /var/www/wedding/frontend

# .env.production
echo 'NEXT_PUBLIC_API_URL=https://api.weddingcraft.ru' > .env.production

npm install
npm run build

pm2 start npm --name wedding-frontend -- start
pm2 save
```

## Caddy
```bash
nano /etc/caddy/Caddyfile
```

```caddy
weddingcraft.ru, www.weddingcraft.ru {
    reverse_proxy localhost:3000
}

api.weddingcraft.ru {
    reverse_proxy localhost:4000
}
```

```bash
systemctl reload caddy
```

## Проверка
```bash
pm2 list
curl http://localhost:4000/api/health
```

## Обновление кода (после изменений)
```bash
cd /var/www/wedding
git pull
cd backend && npm run build && pm2 restart wedding-api
cd ../frontend && npm run build && pm2 restart wedding-frontend
```

## Telegram-бот (после создания в @BotFather)
1. Вписать токен в `/var/www/wedding/backend/.env`
2. Установить вебхук:
```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://api.weddingcraft.ru/api/telegram/webhook"
```
