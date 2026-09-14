'use client';

/* Стартовый экран: открыть существующий проект студии или создать новый. */

import { useEffect, useState } from 'react';
import { FolderOpen, Plus, Loader2, Download } from 'lucide-react';
import { useStudio, listProjects, ProjectSummary, readToken } from '../store';
import { CANVAS_PRESETS, SLUG_RE } from '../types';
import {
  importPageIntoNewProject,
  importPdfIntoNewProject,
  galleryTemplateUrl,
  canAdoptTemplate,
} from '../import/run';
import { TEMPLATES } from '@/lib/constants';
import { isStudioTemplate } from '@/lib/studioTemplates';
import css from '../studio.module.css';

/* Слаг из названия: кириллица переводится в латиницу, остальное — в дефисы. */
const MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .split('')
    .map((ch) => (ch in MAP ? MAP[ch] : ch))
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export default function StartScreen() {
  const createProject = useStudio((s) => s.createProject);
  const openProject = useStudio((s) => s.openProject);
  const loading = useStudio((s) => s.loading);
  const error = useStudio((s) => s.error);
  const needToken = useStudio((s) => s.needToken);
  const submitToken = useStudio((s) => s.submitToken);
  const [token, setToken] = useState('');

  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [width, setWidth] = useState(430);
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState('');
  const [importReport, setImportReport] = useState<string[] | null>(null);
  const [confirmAdopt, setConfirmAdopt] = useState<string | null>(null);

  useEffect(() => {
    listProjects()
      .then(setProjects)
      .catch(() => setProjects([]));
  }, [needToken]);

  const effectiveSlug = slugTouched ? slug : slugify(name);
  const slugValid = SLUG_RE.test(effectiveSlug);

  const create = async () => {
    if (!slugValid) return;
    try {
      await createProject(effectiveSlug, name.trim() || effectiveSlug, width);
    } catch {
      /* сообщение уже в store.error */
    }
  };

  const runImport = async () => {
    if (!slugValid || !importUrl.trim()) return;
    setImportReport(null);
    setImporting('Начинаю…');
    try {
      const report = await importPageIntoNewProject({
        url: importUrl.trim(),
        slug: effectiveSlug,
        name: name.trim() || effectiveSlug,
        width,
        onStep: setImporting,
      });
      setImportReport(report);
    } catch (e) {
      setImportReport([`Не получилось: ${(e as Error).message}`]);
    } finally {
      setImporting('');
    }
  };

  /* Студия открыта не только на этой машине — сервер спрашивает пароль. */
  if (needToken) {
    return (
      <div className={css.start}>
        <div className={css.startInner} style={{ maxWidth: 420 }}>
          <div>
            <h1 className={css.startTitle}>Верстак</h1>
            <p className={css.startSub}>
              Студия открыта по сети и просит пароль. Это тот же STUDIO_TOKEN,
              что задан в frontend/.env.local на машине с сервером.
            </p>
          </div>
          <section className={css.card}>
            <div className={css.field}>
              <label className={css.label} htmlFor="studio-token">
                Пароль студии
              </label>
              <input
                id="studio-token"
                className={css.input}
                type="password"
                value={token}
                autoFocus
                onChange={(e) => setToken(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && token.trim()) submitToken(token);
                }}
              />
            </div>
            <button
              type="button"
              className={`${css.btn} ${css.btnPrimary}`}
              disabled={!token.trim()}
              onClick={() => submitToken(token)}
            >
              Войти
            </button>
            {!!readToken() && (
              <p className={css.hint}>
                Сохранённый пароль не подошёл — введите заново.
              </p>
            )}
          </section>
        </div>
      </div>
    );
  }

  /**
   * Открыть шаблон сайта в студии.
   * copy — рядом появится отдельный шаблон, оригинал не тронут.
   * adopt — студия забирает слаг оригинала. Его файлы копируются в папку
   * _backup-… при первом сохранении: свой script.js студия не воспроизводит,
   * а до сохранения на диске вообще ничего не меняется.
   */
  const openGalleryTemplate = async (
    id: string,
    title: string,
    mode: 'copy' | 'adopt',
  ) => {
    setConfirmAdopt(null);
    setImportReport(null);
    setImporting('Читаю шаблон…');
    try {
      const report = await importPageIntoNewProject({
        url: location.origin + galleryTemplateUrl(id),
        slug: mode === 'adopt' ? id : `${id}-kopiya`,
        name: mode === 'adopt' ? title : `${title} — копия`,
        width: 430,
        adopt: mode === 'adopt',
        /* Оригинал открывается на правку: экспорт допишет разницу отдельным
           файлом, а разметка, стили и script.js шаблона останутся как были. */
        mode: mode === 'adopt' ? 'patch' : 'build',
        onStep: setImporting,
      });
      setImportReport([
        ...report,
        mode === 'adopt'
          ? 'Режим правки: экспорт допишет только разницу, начинка шаблона останется цела'
          : 'Оригинал не тронут — это отдельный шаблон',
      ]);
    } catch (e) {
      setImportReport([`Не получилось: ${(e as Error).message}`]);
    } finally {
      setImporting('');
    }
  };

  return (
    <div className={css.start}>
      <div className={css.startInner}>
        <div>
          <h1 className={css.startTitle}>Верстак</h1>
          <p className={css.startSub}>
            Шаблон собирается слоями на холсте, а нажатие «Экспорт» кладёт готовый
            шаблон в галерею. Инструмент работает только в режиме разработки.
          </p>
        </div>

        {error && <div className={css.error}>{error}</div>}

        <section className={css.card}>
          <div className={css.cardTitle}>Шаблоны сайта — {TEMPLATES.length}</div>
          <p className={css.hint}>
            Рукописные шаблоны студия разбирает на слои. Их программа дня,
            календарь и анкета живут в собственном script.js — студия его не
            воспроизводит, поэтому по умолчанию делается отдельная копия.
          </p>

          <div className={css.projectList}>
            {TEMPLATES.map((tpl) => {
              const inStudio = isStudioTemplate(tpl.id);
              return (
                <div key={tpl.id} className={css.galleryRow}>
                  <span className={css.secName}>
                    {tpl.name}
                    {inStudio && <span className={css.projectItemMeta}> · уже в студии</span>}
                  </span>
                  <button
                    type="button"
                    className={css.btn}
                    disabled={!!importing}
                    onClick={() => openGalleryTemplate(tpl.id, tpl.name, 'copy')}
                  >
                    Сделать копию
                  </button>
                  <button
                    type="button"
                    className={css.btn}
                    disabled={!!importing || inStudio || !canAdoptTemplate(tpl.id)}
                    title={
                      canAdoptTemplate(tpl.id)
                        ? 'Заменить шаблон в галерее на версию из студии'
                        : 'У этого шаблона файлы лежат в общей папке — можно только копию'
                    }
                    onClick={() => setConfirmAdopt(tpl.id)}
                  >
                    Редактировать оригинал
                  </button>
                </div>
              );
            })}
          </div>

          {confirmAdopt && (
            <div className={css.error}>
              <div>
                Шаблон «{TEMPLATES.find((t) => t.id === confirmAdopt)?.name}» будет заменён
                версией из студии. Программа дня, календарь и анкета в нём перестанут
                работать до того, как вы соберёте их блоками студии.
              </div>
              <div>
                Уже опубликованные сайты пар на этом шаблоне изменятся вместе с ним —
                но только когда вы нажмёте «Сохранить». Тогда же копия оригинала
                ляжет в папку _backup-…
              </div>
              <div className={css.widthChoice} style={{ marginTop: 10 }}>
                <button
                  type="button"
                  className={`${css.btn} ${css.btnPrimary}`}
                  onClick={() =>
                    openGalleryTemplate(
                      confirmAdopt,
                      TEMPLATES.find((t) => t.id === confirmAdopt)?.name ?? confirmAdopt,
                      'adopt',
                    )
                  }
                >
                  Понимаю, заменить
                </button>
                <button type="button" className={css.btn} onClick={() => setConfirmAdopt(null)}>
                  Отмена
                </button>
              </div>
            </div>
          )}
        </section>

        <div className={css.startCols}>
          <section className={css.card}>
            <div className={css.cardTitle}>Открыть проект</div>

            {projects === null && (
              <p className={css.hint}>
                <Loader2 size={13} className="animate-spin" /> Читаю public/invite…
              </p>
            )}

            {projects?.length === 0 && (
              <p className={css.hint}>
                Проектов студии пока нет. Создайте первый — он появится в
                public/invite/&lt;слаг&gt;/_studio.json
              </p>
            )}

            {!!projects?.length && (
              <div className={css.projectList}>
                {projects.map((p) => (
                  <button
                    key={p.slug}
                    type="button"
                    className={css.projectItem}
                    onClick={() => openProject(p.slug)}
                    disabled={loading}
                  >
                    <span>
                      <FolderOpen size={13} style={{ marginRight: 7, verticalAlign: -2 }} />
                      {p.name}
                    </span>
                    <span className={css.projectItemMeta}>
                      {p.width}px · {p.sections} секц.
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className={css.card}>
            <div className={css.cardTitle}>Новый проект</div>

            <div className={css.field}>
              <label className={css.label} htmlFor="new-name">
                Название шаблона
              </label>
              <input
                id="new-name"
                className={css.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Например: Пионы"
                autoFocus
              />
            </div>

            <div className={css.field}>
              <label className={css.label} htmlFor="new-slug">
                Слаг — папка шаблона, потом не меняется
              </label>
              <input
                id="new-slug"
                className={`${css.input} ${css.mono}`}
                value={effectiveSlug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value);
                }}
                placeholder="peony"
              />
              {!!effectiveSlug && !slugValid && (
                <span className={css.hint}>
                  Строчные латинские буквы, цифры и дефис, от трёх символов.
                </span>
              )}
            </div>

            <div className={css.field}>
              <span className={css.label}>Эталонная ширина холста</span>
              <div className={css.widthChoice}>
                {CANVAS_PRESETS.map((w) => (
                  <button
                    key={w}
                    type="button"
                    className={`${css.chip} ${width === w ? css.chipOn : ''}`}
                    onClick={() => setWidth(w)}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              className={`${css.btn} ${css.btnPrimary}`}
              onClick={create}
              disabled={!slugValid || loading || !!importing}
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Создать пустой проект
            </button>

            <div className={css.field} style={{ borderTop: '1px solid #35353f', paddingTop: 12 }}>
              <label className={css.label} htmlFor="import-url">
                …или собрать из готовой страницы
              </label>
              <input
                id="import-url"
                className={css.input}
                value={importUrl}
                placeholder="http://localhost:3000/invite/calla/index.html"
                onChange={(e) => setImportUrl(e.target.value)}
              />
              <button
                type="button"
                className={css.btn}
                onClick={runImport}
                disabled={!slugValid || !importUrl.trim() || !!importing}
              >
                {importing ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Download size={14} />
                )}
                {importing || 'Разобрать на слои'}
              </button>
              <label className={`${css.btn} ${css.fileBtn}`}>
                …или разобрать PDF
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  hidden
                  disabled={!slugValid || !!importing}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    setImportReport(null);
                    setImporting('Читаю PDF…');
                    importPdfIntoNewProject({
                      file,
                      slug: effectiveSlug,
                      name: name.trim() || effectiveSlug,
                      width,
                      onStep: setImporting,
                    })
                      .then(setImportReport)
                      .catch((err: Error) => setImportReport([`Не получилось: ${err.message}`]))
                      .finally(() => setImporting(''));
                  }}
                />
              </label>

              <p className={css.hint}>
                Страница грузится в скрытый фрейм, и геометрию считает сам браузер —
                CSS не разбирается вообще. Картинки втягиваются в шаблон.
              </p>
              {importReport && (
                <div className={css.error} style={{ borderColor: '#35353f', background: '#2a2a32', color: '#9b98a6' }}>
                  {importReport.map((line) => (
                    <div key={line}>{line}</div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
