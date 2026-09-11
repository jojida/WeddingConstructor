#!/usr/bin/env bash
#
# Автодеплой weddingcraft.ru.
#
# Смотрит, не появился ли на GitHub новый коммит в main, и если появился —
# подтягивает его и пересобирает фронт. Запускается по таймеру раз в минуту;
# когда ничего не изменилось, выходит мгновенно и ничего не трогает.
#
# Ставится один раз:
#   ( crontab -l 2>/dev/null; echo '* * * * * bash /var/www/wedding/scripts/deploy.sh >> /var/log/wedding-deploy.log 2>&1' ) | crontab -
#
# Именно `bash <путь>`, а не сам путь: тогда биту исполняемости неоткуда
# разойтись с репозиторием. Один `chmod +x` на сервере уже оборачивался тем,
# что git считал файл изменённым и отказывался делать merge — деплой вставал
# намертво, повторяя одну и ту же ошибку каждую минуту.
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

# Старую сборку не удаляем, а отодвигаем.
#
# Удалять было опасно: на 1 ГБ памяти сборщик вполне может уйти в OOM, и тогда
# .next уже стёрт, а новый не собран — сайт начинает отдавать ошибки, и никто
# об этом не узнает до первого звонка от пары. Отодвинутая копия позволяет
# вернуть рабочий сайт за секунду.
#
# Просто оставить .next на месте нельзя: прод тогда отдаёт старую сборку —
# на этом сервере проверено не раз.
rm -rf .next.old
[ -d .next ] && mv .next .next.old

# На 1 ГБ памяти сборщик уходит в OOM, если не ограничить кучу вручную;
# swap есть, но по умолчанию Node о нём не догадывается.
if NODE_OPTIONS=--max-old-space-size=768 npm run build; then
  rm -rf .next.old
  pm2 restart wedding-frontend --update-env
  log "готово"
else
  log "СБОРКА УПАЛА на $remote_rev — возвращаю прежнюю, сайт продолжает работать"
  rm -rf .next
  [ -d .next.old ] && mv .next.old .next

  # Про неудачу нужно узнать, не читая лог целиком.
  {
    echo "проверено:  $(date '+%F %T')"
    echo "на сервере: ${remote_rev:0:7} (код обновлён)"
    echo "состояние:  СБОРКА УПАЛА — сайт работает на прежней сборке"
    echo "подробности: tail -50 /var/log/wedding-deploy.log"
  } > "$STATUS" 2>/dev/null || true

  # Коммит оставляем подтянутым: иначе таймер будет биться об один и тот же
  # сломанный коммит каждую минуту. Чинить — руками.
  exit 1
fi
