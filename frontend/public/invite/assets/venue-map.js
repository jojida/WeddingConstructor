/* ── Карта места проведения (Яндекс Карты) — общий модуль всех шаблонов ──────
   В шаблоне — контейнер <div class="wc-map" data-wc-map hidden></div> в секции
   места. WCMap.set({ address, venue, mapLink, show }) рисует в нём карту и
   кнопку «Построить маршрут» (можно передавать частично: undefined — «без
   изменений»).

   Карта — виджет Яндекс Карт (iframe yandex.ru/map-widget), ключ API не нужен.
   Откуда берётся место, по убыванию точности:
     1) ссылка пары на место в Яндекс Картах (mapLink):
        /maps/org/<имя>/<id> — карточка организации (ресторан, усадьба);
        pt= / whatshere[point]= / ll= — точные координаты;
     2) координаты адреса (point = customData.mapPoint { q, lat, lon }) — их
        один раз находит редактор, когда пара дописала адрес; берём, только
        если они посчитаны для этого же адреса (q);
     3) поиск по адресу силами Яндекса (а без адреса — по названию места).
        Карта встаёт центром на найденное, но в маленьком окне виджет не
        рисует метку — поэтому координаты из п.2 лучше.

   Вид — CSS-переменные на .wc-map в стилях шаблона:
     --wc-map-h, --wc-map-radius, --wc-map-border, --wc-map-shadow,
     --wc-map-accent (кнопка), --wc-map-accent-ink (текст кнопки при наведении),
     --wc-map-font, --wc-map-text (подпись с адресом), --wc-map-width.
   data-wc-map-addr="off" — не показывать адрес под картой (если он уже есть
   в вёрстке рядом).

   Подключение: <script src="../assets/venue-map.js"> ДО script.js шаблона,
   в applyData — WCMap.set({ address: d.venueAddress, venue: d.venue,
   mapLink: d.mapLink, point: d.mapPoint, show: d.showMap }). */
(function () {
  'use strict';

  var EDITING = new URLSearchParams(location.search).get('editing') === '1';
  var state = { address: '', venue: '', mapLink: '', point: null, show: true };
  var timer = 0;

  // Базовый вид — обычными классами (сильнее сброса шаблона вида * { margin:0;
  // padding:0 }), но в начале <head>: правила шаблона с тем же весом идут позже
  // и побеждают, поэтому шаблон донастраивает всё своими классами.
  var CSS =
    '.wc-map{width:100%;max-width:var(--wc-map-width,440px);margin:22px auto 0;text-align:center;box-sizing:border-box}' +
    '.wc-map[hidden]{display:none!important}' +
    '.wc-map__frame{position:relative;height:var(--wc-map-h,240px);border-radius:var(--wc-map-radius,12px);' +
      'overflow:hidden;border:var(--wc-map-border,1px solid rgba(0,0,0,.14));box-shadow:var(--wc-map-shadow,none);' +
      'background:#eceae6;transform:translateZ(0)}' +
    '.wc-map__frame iframe{position:absolute;inset:0;width:100%;height:100%;border:0;display:block}' +
    '.wc-map__addr{margin:16px auto 0;max-width:92%;font-family:var(--wc-map-font,inherit);font-size:14px;' +
      'line-height:1.45;letter-spacing:.03em;color:var(--wc-map-text,inherit)}' +
    '.wc-map__route{display:inline-flex;align-items:center;gap:8px;margin-top:14px;padding:10px 20px;' +
      'border-radius:999px;border:1px solid var(--wc-map-accent,#354366);color:var(--wc-map-accent,#354366);' +
      'background:transparent;font-family:var(--wc-map-font,inherit);font-size:13px;line-height:1;' +
      'letter-spacing:.06em;text-decoration:none;transition:background .2s,color .2s}' +
    '.wc-map__route:hover{background:var(--wc-map-accent,#354366);color:var(--wc-map-accent-ink,#fff)}' +
    '.wc-map__route svg{width:14px;height:14px;flex:none}';

  function injectCss() {
    if (document.getElementById('wc-map-css')) return;
    var st = document.createElement('style');
    st.id = 'wc-map-css';
    st.textContent = CSS;
    // В начало <head>: стили шаблона идут после и при равенстве побеждают
    var head = document.head || document.documentElement;
    head.insertBefore(st, head.firstChild);
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function num(v) { v = parseFloat(v); return isFinite(v) ? v : NaN; }
  function validPoint(lon, lat) {
    return isFinite(lon) && isFinite(lat) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  }

  /* Точка из ссылки пары: организация Яндекса или координаты */
  function fromLink(link) {
    if (!link) return null;
    var u;
    try { u = new URL(link); } catch (e) { return null; }
    if (!/^https?:$/.test(u.protocol)) return null;
    var host = u.hostname.replace(/^www\./, '');
    var p = u.searchParams;
    if (/(^|\.)yandex\.[a-z.]+$|(^|\.)ya\.ru$/.test(host)) {
      var org = u.pathname.match(/\/maps\/(?:\d+\/[^/]+\/)?org\/[^/]*\/(\d+)/);
      if (org) return { oid: org[1] };
      var pair = p.get('pt') || p.get('whatshere[point]') || p.get('ll');
      if (pair) {
        var xy = pair.split('~')[0].split(',');
        var lon = num(xy[0]), lat = num(xy[1]);
        if (validPoint(lon, lat)) return { lon: lon, lat: lat };
      }
      return null;
    }
    if (/(^|\.)google\.[a-z.]+$|(^|\.)goo\.gl$/.test(host)) {
      var at = link.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/) ||
        (p.get('q') || '').match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/);
      if (at && validPoint(num(at[2]), num(at[1]))) return { lon: num(at[2]), lat: num(at[1]) };
    }
    return null;
  }

  /* Координаты, найденные редактором для этого самого адреса */
  function geocoded(address) {
    var p = state.point;
    if (!p || !address || String(p.q || '').trim() !== address) return null;
    var lon = num(p.lon), lat = num(p.lat);
    return validPoint(lon, lat) ? { lon: lon, lat: lat } : null;
  }

  function widgetUrl(q, point) {
    var base = 'https://yandex.ru/map-widget/v1/?';
    if (point && point.oid) return base + 'ol=biz&oid=' + point.oid + '&z=16';
    if (point) {
      var ll = point.lon + ',' + point.lat;
      return base + 'll=' + encodeURIComponent(ll) + '&pt=' + encodeURIComponent(ll + ',pm2rdm') + '&z=16';
    }
    return base + 'text=' + encodeURIComponent(q) + '&z=16';
  }

  // Маршрут: до точки из ссылки, иначе — до найденного по адресу
  function routeUrl(q, point) {
    var to = point && !point.oid ? point.lat + ',' + point.lon : q;
    return 'https://yandex.ru/maps/?rtext=~' + encodeURIComponent(to) + '&rtt=auto';
  }

  var PIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>';

  function render() {
    var boxes = document.querySelectorAll('[data-wc-map]');
    if (!boxes.length) return;
    var address = (state.address || '').trim();
    var q = address || (state.venue || '').trim();
    var link = (state.mapLink || '').trim();
    var linkPoint = fromLink(link);
    var point = linkPoint || geocoded(address);
    var visible = state.show !== false && (!!q || !!point);
    var key = [q, link, point ? point.oid || point.lon + ',' + point.lat : '', visible].join('\n');
    injectCss();
    boxes.forEach(function (box) {
      box.hidden = !visible;
      if (!visible || box.__wcMapKey === key) return;
      box.__wcMapKey = key;
      var title = 'Карта: ' + (state.venue || address || 'место проведения');
      var addr = address && box.getAttribute('data-wc-map-addr') !== 'off'
        ? '<p class="wc-map__addr">' + esc(address) + '</p>' : '';
      // Своя ссылка пары без точки (короткая ссылка, 2ГИС…) — её и открываем
      var go = link && !linkPoint
        ? '<a class="wc-map__route" href="' + esc(link) + '" target="_blank" rel="noopener">' + PIN + 'Открыть карту</a>'
        : '<a class="wc-map__route" href="' + esc(routeUrl(q, point)) + '" target="_blank" rel="noopener">' + PIN + 'Построить маршрут</a>';
      box.innerHTML =
        '<div class="wc-map__frame"><iframe src="' + esc(widgetUrl(q, point)) + '" title="' + esc(title) + '"' +
        ' loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade"></iframe></div>' + addr + go;
    });
  }

  function set(d) {
    if (!d) return;
    ['address', 'venue', 'mapLink', 'point', 'show'].forEach(function (k) {
      if (d[k] !== undefined && d[k] !== null) state[k] = d[k];
    });
    // В редакторе адрес набирают по букве: карту перезагружаем, когда набор утих
    clearTimeout(timer);
    if (EDITING) timer = setTimeout(render, 700); else render();
  }

  window.WCMap = { set: set };
})();
