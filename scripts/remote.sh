#!/usr/bin/env bash
#
# Узкая калитка для Верстака.
#
# Ключ wedding-deploy прописан в authorized_keys с `command="…/remote.sh"`, то
# есть по нему нельзя получить шелл: что бы клиент ни прислал, sshd запускает
# этот файл. Разрешено ровно пять действий, перечисленных ниже, — ни базы, ни
# .env, ни ключей ЮKassa через эту калитку не достать.
#
# Ставится один раз, на сервере:
#   printf '%s %s\n' \
#     'command="bash /var/www/wedding/scripts/remote.sh",no-pty,no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-user-rc' \
#     'ssh-ed25519 …ключ… wedding-deploy' >> /root/.ssh/authorized_keys
#
# Отозвать:  sed -i '/wedding-deploy/d' /root/.ssh/authorized_keys

set -euo pipefail

REPO=/var/www/wedding
FRONT="$REPO/frontend"

case "${SSH_ORIGINAL_COMMAND:-status}" in

  status)
    cat /var/log/wedding-deploy.status 2>/dev/null || echo 'отметки ещё нет'
    echo "--- коммит на сервере:"
    git -C "$REPO" log --oneline -1
    ;;

  log)
    tail -40 /var/log/wedding-deploy.log 2>/dev/null || echo 'лог пуст'
    ;;

  deploy)
    # Тот же скрипт, что зовёт таймер. Если он уже работает, замок не пустит,
    # и это правильно: две сборки разом добьют память.
    bash "$REPO/scripts/deploy.sh"
    ;;

  health)
    pm2 list 2>/dev/null | grep -E 'wedding|name' || echo 'pm2 молчит'
    echo "--- локально:"
    for path in / /templates /invite/calla/index.html; do
      printf '  %-28s %s\n' "$path" \
        "$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "http://localhost:3002$path")"
    done
    echo "--- память:"
    free -m | awk 'NR<=2{print "  "$0}'
    echo "--- диск:"
    df -h / | awk 'NR==2{print "  занято "$5" из "$2", свободно "$4}'
    ;;

  rollback)
    # Возврат на отодвинутую сборку — если деплой оставил сайт не в том виде.
    if [ -d "$FRONT/.next.old" ]; then
      rm -rf "$FRONT/.next"
      mv "$FRONT/.next.old" "$FRONT/.next"
      pm2 restart wedding-frontend --update-env
      echo 'прежняя сборка возвращена'
    else
      echo 'возвращать нечего: .next.old нет'
    fi
    ;;

  *)
    echo "через эту калитку можно только: status, log, deploy, health, rollback"
    exit 2
    ;;
esac
