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

# Legacy runtime files are still tracked. A merge that removes or changes them
# could erase real customer data. Migrate data outside the checkout and review
# the rollout before accepting any such change. Never reset these paths.
if ! git diff --quiet "$local_rev" "$remote_rev" -- backend/dev.db backend/prisma/dev.db backend/uploads; then
  log "ОСТАНОВЛЕНО: коммит меняет рабочие БД или загрузки. Сначала резервная копия и перенос данных за пределы checkout."
  exit 1
fi

# Лок-файл на сервере расходится с репозиторием после npm install — из-за
# него pull спотыкается, хотя менять его никто не собирался.
git checkout -- frontend/package-lock.json 2>/dev/null || true
git merge --ff-only "origin/$BRANCH"

# ВНИМАНИЕ: всё, что ВЫШЕ строки с merge, не менять без крайней нужды.
# Этот файл обновляет сам себя: bash дочитывает скрипт с диска по ходу
# выполнения, и после merge продолжает с той же позиции в байтах уже в
# новой версии. Сдвиг хоть на байт выше merge — и bash выполнит обрывок
# строки, упадёт по set -e, а следующий запуск увидит «всё свежее» и
# сборку так и не сделает. Ниже merge менять можно — это и выполнится.

log "$(git log --oneline -1)"

# Бэкенд трогаем, только если он и правда менялся: рестарт роняет активные
# сессии оплаты, делать его на каждый шаблон незачем.
if ! git diff --quiet "$local_rev" "$remote_rev" -- backend; then
  log "менялся бэкенд — пересобираю"
  cd "$REPO/backend"
  ONNXRUNTIME_NODE_INSTALL=skip npm ci --no-audit --no-fund
  npx prisma generate
  npm run build
  pm2 restart wedding-api --update-env
  cd "$REPO"
fi

cd "$REPO/frontend"

# package.json тронули — значит, могли появиться новые зависимости.
if ! git diff --quiet "$local_rev" "$remote_rev" -- frontend/package.json frontend/package-lock.json; then
  log "менялся package.json — ставлю зависимости"
  npm ci --no-audit --no-fund
fi

# Собираем в отдельную папку (distDir из WC_BUILD_DIR, см. next.config.ts),
# а рабочую .next не трогаем до самого перезапуска.
#
# Раньше .next отодвигалась ДО сборки, и все минуты сборки живой сервер
# работал без своих файлов: страницы, уже лежавшие в памяти (главная),
# открывались, а остальные (каталог, демо) отдавали 500 — до самого конца
# сборки. Теперь подмена — одно переименование прямо перед рестартом.
# Сборка под другим именем папки после переименования работает: при запуске
# Next берёт папку из конфига, зашитое имя на это не влияет (проверено).
BUILD_DIR=.next-build
rm -rf "$BUILD_DIR" .next.old

# На 1 ГБ памяти сборщик уходит в OOM, если не ограничить кучу вручную;
# swap есть, но по умолчанию Node о нём не догадывается.
if WC_BUILD_DIR="$BUILD_DIR" NODE_OPTIONS=--max-old-space-size=768 npm run build; then
  # Сборка с другим distDir дописывает его в tsconfig.json — вернуть,
  # иначе следующий merge споткнётся о «локальные правки».
  git checkout -- tsconfig.json 2>/dev/null || true
  [ -d .next ] && mv .next .next.old
  mv "$BUILD_DIR" .next
  pm2 restart wedding-frontend --update-env
  rm -rf .next.old
  log "готово"
else
  git checkout -- tsconfig.json 2>/dev/null || true
  log "СБОРКА УПАЛА на $remote_rev — рабочая сборка не тронута, сайт продолжает работать"
  rm -rf "$BUILD_DIR"

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
