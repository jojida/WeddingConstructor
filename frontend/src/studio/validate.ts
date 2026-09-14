/* ═══════════════════════════════════════════════════════════════════════════
   Верстак — проверка шаблона перед экспортом.

   Всё это — ошибки, которые вылезают не в студии, а на живом сайте у пары:
   текст за краем холста, шрифт, который подключить забыли, два поля с одним
   ключом. Дешевле поймать здесь.
   ═══════════════════════════════════════════════════════════════════════════ */

import { Project, sectionHeightPx } from './types';

export type IssueLevel = 'error' | 'warn';

export interface Issue {
  level: IssueLevel;
  text: string;
  layerId?: string;
  sectionId?: string;
}

/** Больше этого веса картинка заметно тормозит страницу гостя. */
const HEAVY_BYTES = 400 * 1024;

export function validate(project: Project): Issue[] {
  const issues: Issue[] = [];
  const width = project.canvas.width;
  const fontKeys = new Set(project.fonts.map((f) => f.key));
  const usedKeys = new Map<string, number>();
  const usedAssets = new Set<string>();

  for (const section of project.sections) {
    const height = sectionHeightPx(section, width);
    if (section.background.image) usedAssets.add(section.background.image);

    if (!section.layers.length) {
      issues.push({
        level: 'warn',
        sectionId: section.id,
        text: `Секция «${section.name}» пустая`,
      });
    }

    for (const layer of section.layers) {
      if (layer.hidden) continue;

      /* геометрия */
      if (layer.x + layer.w < 0 || layer.x > width || layer.y + layer.h < 0) {
        issues.push({
          level: 'warn',
          layerId: layer.id,
          sectionId: section.id,
          text: `«${layer.name}» целиком за пределами холста`,
        });
      } else if (layer.y + layer.h > height + 1) {
        issues.push({
          level: 'warn',
          layerId: layer.id,
          sectionId: section.id,
          text: `«${layer.name}» выходит за нижний край секции на ${Math.round(
            layer.y + layer.h - height,
          )} px`,
        });
      }

      /* редактируемые поля */
      if ((layer.kind === 'text' || layer.kind === 'image') && layer.editable) {
        const key = layer.editable.key;
        usedKeys.set(key, (usedKeys.get(key) ?? 0) + 1);
        if (!key.trim()) {
          issues.push({
            level: 'error',
            layerId: layer.id,
            text: `У «${layer.name}» пустой ключ поля — оно не попадёт в кабинет`,
          });
        }
        if (layer.kind === 'text' && !layer.editable.maxLength) {
          issues.push({
            level: 'warn',
            layerId: layer.id,
            text: `«${layer.name}»: поле без лимита символов — длинный текст вылезет за рамку`,
          });
        }
      }

      /* текст */
      if (layer.kind === 'text') {
        // Ругаемся только на переменную без запасного варианта: у записи вида
        // var(--font-body, serif) текст всё равно отрисуется, и предупреждение
        // тут было бы ложной тревогой.
        const match = /var\(\s*--font-([a-z0-9-]+)\s*\)/i.exec(layer.font);
        if (match && !fontKeys.has(match[1])) {
          issues.push({
            level: 'error',
            layerId: layer.id,
            text: `«${layer.name}»: шрифт --font-${match[1]} не подключён в шаблоне`,
          });
        }
        if (!layer.content.trim()) {
          issues.push({
            level: 'warn',
            layerId: layer.id,
            text: `«${layer.name}»: пустой текст`,
          });
        }
      }

      /* картинки */
      if (layer.kind === 'image') {
        if (!layer.assetId) {
          issues.push({
            level: 'error',
            layerId: layer.id,
            text: `«${layer.name}»: файл не выбран`,
          });
        } else {
          usedAssets.add(layer.assetId);
          const asset = project.assets.find((a) => a.id === layer.assetId);
          if (asset && asset.bytes > HEAVY_BYTES) {
            issues.push({
              level: 'warn',
              layerId: layer.id,
              text: `«${layer.name}»: файл ${Math.round(asset.bytes / 1024)} КБ — тяжело для страницы`,
            });
          }
        }
        if (!layer.alt.trim()) {
          issues.push({
            level: 'warn',
            layerId: layer.id,
            text: `«${layer.name}»: нет подписи для читалок и поиска`,
          });
        }
      }
    }
  }

  for (const [key, count] of usedKeys) {
    if (count > 1) {
      issues.push({
        level: 'error',
        text: `Ключ «${key}» занят ${count} слоями — в кабинете они склеятся в одно поле`,
      });
    }
  }

  for (const asset of project.assets) {
    if (!usedAssets.has(asset.id)) {
      issues.push({
        level: 'warn',
        text: `Файл ${asset.file} лежит в шаблоне, но нигде не используется`,
      });
    }
  }

  if (!project.catalog.description.trim()) {
    issues.push({ level: 'warn', text: 'У шаблона нет описания для карточки в галерее' });
  }

  // Сначала ошибки, потом предупреждения — читать сверху вниз.
  return issues.sort((a, b) => (a.level === b.level ? 0 : a.level === 'error' ? -1 : 1));
}
