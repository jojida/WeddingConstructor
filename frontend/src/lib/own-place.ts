import { TEMPLATE_DEFAULTS } from './constants';

/* Место и адрес из примеров шаблонов — не место пары: пустое поле при выборе
   шаблона заполняется примером. Сравниваем со всеми шаблонами, а не только с
   текущим: в старых черновиках после смены шаблона мог остаться пример прежнего.
   Тот же список на сервере (письма) — backend/src/lib/templatePlaces.ts,
   совпадение проверяет backend/tests/templatePlaces.cjs. */
const samples = (key: 'venue' | 'venueAddress') =>
  new Set(Object.values(TEMPLATE_DEFAULTS).map(d => d[key]?.trim()).filter((v): v is string => !!v));
const SAMPLE_VENUES = samples('venue');
const SAMPLE_ADDRESSES = samples('venueAddress');

const own = (value: unknown, sample: Set<string>) => {
  const text = typeof value === 'string' ? value.trim() : '';
  return text && !sample.has(text) ? text : '';
};

/** Своё место и адрес пары; пустая строка — своего нет (пусто или пример шаблона). */
export function ownPlace(data: { venue?: string | null; venueAddress?: string | null }): { venue: string; address: string } {
  return { venue: own(data.venue, SAMPLE_VENUES), address: own(data.venueAddress, SAMPLE_ADDRESSES) };
}

/** Название в «кавычках», если своих кавычек в нём нет: Ресторан «Белый сад». */
export const quotePlace = (place: string): string => (/[«»"„“]/.test(place) ? place : `«${place}»`);
