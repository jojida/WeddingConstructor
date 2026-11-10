'use client';
import { useId, useRef, useState } from 'react';
import { Check, WandSparkles } from 'lucide-react';
import { TEXT_TONES, type TextTone, type TextVariant } from '@/lib/text-variants';
import s from './TextVariants.module.css';

const TONE_ONE = Object.fromEntries(TEXT_TONES.map(t => [t.id, t.one])) as Record<TextTone, string>;

/* «Выбрать варианты текста» под длинным полем: список карточек с готовыми
   текстами. Нажатие ставит текст в поле сразу — превью обновляется, можно
   перебрать несколько вариантов и остановиться на любом. Свой текст, который
   был в поле до выбора, возвращается одной кнопкой. Список раскрывается под
   полем, а не окном поверх: на компьютере рядом остаётся видно превью. */
export default function TextVariants({ label, variants, value, onPick }: {
  label: string;
  variants: TextVariant[];
  value: string;
  onPick: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tone, setTone] = useState<TextTone | 'all'>('all');
  // Что было в поле, когда открыли список: своё пары можно вернуть
  const [before, setBefore] = useState<string | null>(null);
  const panelId = useId();
  const openBtn = useRef<HTMLButtonElement>(null);

  const toggle = () => {
    if (!open) {
      setBefore(value);
      // Список ниже поля, а низ карточки закрывает «Далее» — подводим кнопку к
      // верху: под ней видно подсказку и первые варианты
      requestAnimationFrame(() => openBtn.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
    }
    setOpen(o => !o);
  };
  const close = () => { setOpen(false); openBtn.current?.focus(); };

  const tones = TEXT_TONES.filter(t => variants.some(v => v.tone === t.id));
  const shown = tone === 'all' ? variants : variants.filter(v => v.tone === tone);
  const ownBefore = !!before && before.trim() !== '' && !variants.some(v => v.text === before);
  const canRestore = ownBefore && value !== before;

  return (
    <div className={s.wrap}>
      <button ref={openBtn} type="button" className={s.openBtn} aria-expanded={open} aria-controls={panelId} onClick={toggle}>
        <WandSparkles size={18} strokeWidth={1.8} aria-hidden />
        {open ? 'Скрыть варианты' : 'Выбрать варианты текста'}
      </button>

      {open && (
        <div id={panelId} className={s.panel} role="region" aria-label={`Готовые тексты: ${label}`}
          onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } }}>
          <p className={s.hint}>Нажмите на вариант — он сразу появится в приглашении. Потом его можно поправить в поле выше.</p>

          {tones.length > 1 && (
            <div className={s.tones} role="group" aria-label="Тон текста">
              <button type="button" className={s.tone} aria-pressed={tone === 'all'} onClick={() => setTone('all')}>Все</button>
              {tones.map(t => (
                <button key={t.id} type="button" className={s.tone} aria-pressed={tone === t.id} onClick={() => setTone(t.id)}>{t.many}</button>
              ))}
            </div>
          )}

          <ul className={s.list}>
            {shown.map(v => {
              const on = v.text === value;
              return (
                <li key={v.text}>
                  <button type="button" className={s.card} aria-pressed={on} onClick={() => onPick(v.text)}>
                    <span className={s.cardText}>{v.text}</span>
                    <span className={s.cardMeta}>
                      <span className={s.cardTone}>{TONE_ONE[v.tone]}</span>
                      {on && <span className={s.chosen}><Check size={15} strokeWidth={2.4} aria-hidden /> В приглашении</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className={s.foot}>
            {canRestore
              ? <button type="button" className={s.restore} onClick={() => onPick(before!)}>Вернуть мой текст</button>
              : <span />}
            <button type="button" className={s.done} onClick={close}>Готово</button>
          </div>
        </div>
      )}
    </div>
  );
}
