/* Место и адрес из примеров шаблонов (frontend/src/lib/constants.ts,
   TEMPLATE_DEFAULTS). Пустое поле при выборе шаблона заполняется примером —
   это не место пары, и письмо не должно сказать «вы указали Усадьбу Кусково»
   тому, кто ничего не указывал. Совпадение со списком фронтенда проверяет
   tests/templatePlaces.cjs: шаблон с новым примером места добавить и сюда. */
export const SAMPLE_VENUES = new Set([
  'Юсуповский дворец', 'Дворец бракосочетания №1', 'Усадьба «Архангельское»', 'Усадьба Кусково',
  'Дворцовая усадьба', 'Белая роща', 'Дворцовая усадьба 12', 'База отдыха «Барвиха»',
  'Дворец бракосочетания 12/8', 'Хвойный 17', 'СПА Отель',
]);
export const SAMPLE_ADDRESSES = new Set([
  'Санкт-Петербург, наб. реки Мойки, 94', 'Санкт-Петербург, Английская наб., 28',
  'Московская обл., Красногорск, пос. Архангельское', 'Москва, ул. Юности, 2',
  'Москва, ул. Дольская, 1', 'г. Сочи, ул. Приморская, 15',
]);

const own = (value: string | null | undefined, samples: Set<string>) => {
  const text = (value || '').trim();
  return text && !samples.has(text) ? text : '';
};

/** Своё место пары для текста письма: название, а нет его — адрес; null — своего нет. */
export function ownPlace(venue?: string | null, address?: string | null): { kind: 'venue' | 'address'; text: string } | null {
  const v = own(venue, SAMPLE_VENUES);
  if (v) return { kind: 'venue', text: v };
  const a = own(address, SAMPLE_ADDRESSES);
  return a ? { kind: 'address', text: a } : null;
}

/** Название в «кавычках», если своих кавычек в нём нет: Ресторан «Белый сад». */
export const quotePlace = (place: string): string => (/[«»"„“]/.test(place) ? place : `«${place}»`);
