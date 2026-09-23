# WeddingConstructor

## Проект
Next.js фронтенд + статические HTML шаблоны свадебных приглашений.
Локальный сервер: localhost:3000

## Структура
frontend/
  public/
    invite/
      index.html          ← шаблон Средиземноморье
      floral/
        index.html        ← шаблон Флоральный
      assets/             ← SVG и изображения

## Как запускается
cd frontend && npm run dev

## Как смотреть шаблоны
localhost:3000/invite/
localhost:3000/invite/floral/

## Canva → HTML шаблон
Когда получаю Canva Design ID + PNG + SVG файлы:
1. Читаю дизайн через Canva MCP (start-editing-transaction → cancel)
2. Извлекаю токены: цвета, шрифты, позиции из JSON
3. Создаю frontend/public/invite/[название]/index.html
4. Ассеты кладу в frontend/public/invite/[название]/assets/
5. Проверяю на localhost:3000/invite/[название]/

## Технические заметки
- GSAP не тикает в iframe → шим RAF через setTimeout(16ms)
- gsap.ticker.useRAF() не существует в GSAP 3 — не использовать
- Тяжёлые SVG с base64 — анализировать через canvas, не как текст
- SVG из Canva прячут прозрачность в <mask> с <image> внутри и feColorMatrix.
  Safari на iOS такую маску не применяет: вместо картинки с прозрачным фоном
  показывается исходное фото вместе с чёрной подложкой. Chrome рендерит
  правильно, поэтому на десктопе баг не виден. Такие файлы перед публикацией
  пересобирать в webp с альфа-каналом (canvas.toBlob, качество 0.86 — как в
  src/studio/assets/ingest.ts). Векторные маски (<mask> без <image>) в Safari
  работают, их трогать не нужно.

## Деплой
git add . && git commit -m "описание" && git push
