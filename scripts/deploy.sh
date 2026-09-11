#!/usr/bin/env bash
#
# Автодеплой weddingcraft.ru.
#
# Смотрит, не появился ли на GitHub новый коммит в main, и если появился —
# подтягивает его и пересобирает фронт. Запускается по таймеру раз в минуту;
# когда ничего не изменилось, выходит мгновенно и ничего не трогает.
#
# Ставится один раз:
#   chmod +x /var/www/wedding/scripts/deploy.sh
#   ( crontab -l 2>/dev/null; echo '* * * * * /var/www/wedding/scripts/deploy.sh >> /var/log/wedding-deploy.log 2>&1' ) | crontab -
#
# Запускать именно из репозитория, а не из копии в /usr/local/bin: копия
# застынет на той версии, что была при установке, и правки этого файла до
# сервера уже не доедут.
#
# Жив ли он:         cat /var/log/wedding-deploy.status
# Что делал:         tail -f /var/log/wedding-deploy.log
# Прогнать руками:   /var/www/wedding/scripts/deploy.sh

set -euo pipefail

REPO=/var/www/wedding
BRANCH=main
LOCK=/tmp/wedding-deploy.lock
STATUS=/var/log/wedding-deploy.status

# Сборка занимает минуты, а таймер тикает раз в минуту — без замка запуски
# наложились бы друг на друга и добили 1 ГБ памяти.
exec 9>"$LOCK"
flock -n 9 || exit 0

log() { echo "[$(date '+%F %T')] $*"; }

cd "$REPO"

git fetch --quiet origin "$BRANCH"
local_rev=$(git rev-parse HEAD)
remote_rev=$(git rev-parse "origin/$BRANCH")

# Отметка живости. В лог писать нечего, когда ничего не изменилось, — иначе он
# распухал бы на полторы тысячи строк в сутки. Но и молчание сбивает с толку:
# по пустому логу не отличить «жду» от «не запускаюсь». Поэтому время
# последней проверки кладём в отдельный файл, который всегда перезаписывается.
if [ "$local_rev" = "$remote_rev" ]; then state='всё свежее'; else state='есть что забрать'; fi
{
  echo "проверено:  $(date '+%F %T')"
  echo "на сервере: ${local_rev:0:7}"
  echo "на GitHub:  ${remote_rev:0:7}"
  echo "состояние:  $state"
} > "$STATUS" 2>/dev/null || true

[ "$local_rev" = "$remote_rev" ] && exit 0

log "новый коммит $remote_rev — обновляюсь"

# Лок-файл на сервере расходится с репозиторием после npm install — из-за
# него pull спотыкается, хотя менять его никто не собирался.
git checkout -- frontend/package-lock.json 2>/dev/null || true
git merge --ff-only "origin/$BRANCH"

log "$(git log --oneline -1)"

# Бэкенд трогаем, только если он и правда менялся: рестарт роняет активные
# сессии оплаты, делать его на каждый шаблон незачем.
if ! git diff --quiet "$local_rev" "$remote_rev" -- backend; then
  log "менялся бэкенд — пересобираю"
  cd "$REPO/backend"
  npm install --no-audit --no-fund
  npm run build
  pm2 restart wedding-api --update-env
  cd "$REPO"
fi

cd "$REPO/frontend"

# package.json тронули — значит, могли появиться новые зависимости.
if ! git diff --quiet "$local_rev" "$remote_rev" -- frontend/package.json; then
  log "менялся package.json — ставлю зависимости"
  npm install --no-audit --no-fund
fi

# Без этого прод отдаёт старую сборку: проверено на этом сервере не раз.
rm -rf .next

# На 1 ГБ памяти сборщик уходит в OOM, если не ограничить кучу вручную;
# swap есть, но по умолчанию Node о нём не догадывается.
NODE_OPTIONS=--max-old-space-size=768 npm run build

pm2 restart wedding-frontend --update-env
log "готово"
