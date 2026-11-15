/* Запуск сервера Next. register вызывается один раз на старте и обязан завершиться до первых
   запросов, поэтому сеть здесь не ждём: отправка в IndexNow уходит таймером.
   (Счётчик Метрики в браузере — отдельный файл instrumentation-client.ts.) */
export async function register(): Promise<void> {
  /* Именно так, условием вокруг import: сборщик выбрасывает ветку целиком для edge-среды.
     С «if (не nodejs) return» выше импорта он тянул node:fs в edge-сборку, и `next dev`
     падал с ошибкой 500 на каждой странице. */
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { pingIndexNow } = await import('./lib/indexnow');
    // Через 20 секунд после старта: сервер уже отвечает, и поисковик, придя за страницей, получит новую версию
    const timer = setTimeout(() => { void pingIndexNow().catch(() => { /* повторится при следующем запуске */ }); }, 20_000);
    timer.unref();
  }
}
