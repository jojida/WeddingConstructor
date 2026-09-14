'use client';

/* ═══════════════════════════════════════════════════════════════════════════
   Верстак — правка текста прямо в разметке шаблона.

   Стилями текст не поменяешь, поэтому здесь единственное место, где студия
   трогает содержимое index.html. И трогает точечно.

   Почему не через разбор документа: браузер, разобрав HTML и собрав обратно,
   переписывает почти весь файл — у «Калл» из 180 строк совпадает 12. Правка
   одной надписи давала бы диф на три сотни строк, и понять по нему, что
   именно изменилось, стало бы невозможно.

   Поэтому работаем по исходному тексту: находим открывающий тег по
   единственной приметe элемента, заменяем содержимое до ближайшего
   закрывающего — и остальной файл остаётся байт в байт прежним.

   Правим только элементы, внутри которых нет других элементов: там «ближайший
   закрывающий тег» — это точно свой закрывающий тег.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface TextEdit {
  selector: string;
  content: string;
  /** текст, каким он был в шаблоне — по нему элемент можно найти в файле */
  was?: string;
}

export interface HtmlPatchResult {
  html: string;
  applied: number;
  skipped: { selector: string; why: string }[];
}

const escapeRe = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Регулярка по старому тексту.
 *
 * В файле он может быть разбит переносами и записан сущностями, а в слой попал
 * уже собранным в одну строку — поэтому пробелы ищем как любой их набор, а «&»
 * разрешаем встретить и сущностью.
 */
function textAnchor(was: string): RegExp {
  const body = was
    .trim()
    .split(/\s+/)
    .map((word) => escapeRe(word).replace(/&/g, '(?:&|&amp;)'))
    .join('\\s+');
  return new RegExp(body, 'g');
}

/** Текст → безопасное содержимое элемента. */
const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Примета, по которой элемент однозначно находится в исходном тексте. */
function signature(el: Element): { attr: string; value: string } | null {
  for (const attr of ['id', 'data-edit', 'data-name', 'data-field']) {
    const value = el.getAttribute(attr);
    if (value) return { attr, value };
  }
  // Значение class берём как оно записано в исходнике: документ разобран из
  // самого файла, значит динамических классов там ещё нет.
  const cls = el.getAttribute('class');
  return cls ? { attr: 'class', value: cls } : null;
}

/**
 * Вписывает новые тексты в разметку.
 *
 * `source` — файл как есть; `doc` — он же, разобранный, нужен чтобы найти
 * элемент по селектору и убедиться, что внутри у него только текст.
 */
export function applyTextEdits(
  source: string,
  edits: TextEdit[],
  doc: Document,
): HtmlPatchResult {
  let html = source;
  let applied = 0;
  const skipped: { selector: string; why: string }[] = [];

  for (const edit of edits) {
    let el: Element | null = null;
    try {
      el = doc.querySelector(edit.selector);
    } catch {
      skipped.push({ selector: edit.selector, why: 'селектор не разобрался' });
      continue;
    }
    if (!el) {
      skipped.push({ selector: edit.selector, why: 'элемента нет в разметке файла' });
      continue;
    }
    if (el.children.length) {
      skipped.push({ selector: edit.selector, why: 'внутри есть вложенные элементы' });
      continue;
    }

    const sign = signature(el);

    /* У элемента без приметы — безымянный <p> внутри блока, например — есть
       другая: его собственный текст. Если он встречается в файле один раз,
       этого довольно, чтобы заменить именно его. */
    if (!sign) {
      if (!edit.was) {
        skipped.push({ selector: edit.selector, why: 'элемент нечем опознать в тексте' });
        continue;
      }
      const anchor = [...html.matchAll(textAnchor(edit.was))];
      if (anchor.length !== 1) {
        skipped.push({
          selector: edit.selector,
          why: anchor.length
            ? `такой текст в файле встречается ${anchor.length} раз`
            : 'старый текст в файле не найден',
        });
        continue;
      }
      const at = anchor[0].index!;
      html = html.slice(0, at) + escapeHtml(edit.content) + html.slice(at + anchor[0][0].length);
      applied += 1;
      continue;
    }

    const tag = el.tagName.toLowerCase();
    const open = new RegExp(
      `<${tag}\\b[^>]*\\s${escapeRe(sign.attr)}="${escapeRe(sign.value)}"[^>]*>`,
      'g',
    );
    const hits = [...html.matchAll(open)];
    if (hits.length !== 1) {
      skipped.push({
        selector: edit.selector,
        why: hits.length ? `таких мест в файле ${hits.length}` : 'не нашёлся в тексте файла',
      });
      continue;
    }

    const start = hits[0].index! + hits[0][0].length;
    const close = html.indexOf(`</${tag}`, start);
    if (close < 0) {
      skipped.push({ selector: edit.selector, why: 'нет закрывающего тега' });
      continue;
    }

    html = html.slice(0, start) + escapeHtml(edit.content) + html.slice(close);
    applied += 1;
  }

  return { html, applied, skipped };
}
