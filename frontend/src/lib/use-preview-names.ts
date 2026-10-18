'use client';
import { useEffect, useRef, useState } from 'react';
import { reachGoal, GOAL } from './metrika';
import { NO_NAMES, readPreviewNames, writePreviewNames, type PreviewNames } from './preview-names';

/** Поля «Имя жениха» / «Имя невесты» и имена для превью шаблонов (каталог, главная).

    Поля неуправляемые (defaultValue + ref): страница приходит с сервера, и на
    медленном интернете человек начинает печатать раньше, чем она оживёт. Управляемые
    поля React при оживлении сбрасывал, и имена пропадали (проверено на проде
    18.10.26). Поэтому после монтирования берём уже вписанное, а если пусто — имена
    из прошлого визита (localStorage).
    Превью обновляются через 0,3 с после ввода: перерисовывать все приглашения на
    каждую букву тяжело. Цель catalog_names с параметром from (где вписали) — раз за
    визит страницы, когда вписаны оба имени. */
export function usePreviewNames(from: string) {
  const [names, setNames] = useState<PreviewNames>(NO_NAMES);
  const [shown, setShown] = useState<PreviewNames>(NO_NAMES);
  const groomRef = useRef<HTMLInputElement>(null);
  const brideRef = useRef<HTMLInputElement>(null);
  const typedRef = useRef(false);
  const goalSentRef = useRef(false);
  const initRef = useRef(false);   // в разработке StrictMode запускает эффект дважды

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    const typed = { groom: groomRef.current?.value || '', bride: brideRef.current?.value || '' };
    if (typed.groom || typed.bride) {
      typedRef.current = true;
      setNames(typed);
      return;
    }
    const saved = readPreviewNames();
    if (groomRef.current) groomRef.current.value = saved.groom;
    if (brideRef.current) brideRef.current.value = saved.bride;
    setNames(saved);
    setShown(saved);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShown(names);
      if (!typedRef.current) return;
      writePreviewNames(names);
      if (!goalSentRef.current && names.groom.trim() && names.bride.trim()) {
        goalSentRef.current = true;
        reachGoal(GOAL.catalogNames, { from });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [names, from]);

  const setName = (key: keyof PreviewNames, value: string) => {
    typedRef.current = true;
    setNames(prev => ({ ...prev, [key]: value }));
  };

  return { groomRef, brideRef, shown, setName };
}
