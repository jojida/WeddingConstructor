export const PRINT_PRICE = 290;
export const PRINT_TEMPLATES = [
  { id: 'newspaper', name: 'Свадебный вестник', category: 'Редакционный', color: '#e7d8c3', description: 'Ваша главная новость на первой полосе' },
  { id: 'petals', name: 'Шёпот лепестков', category: 'Романтика', color: '#ecded9', description: 'Объёмные цветы, жемчуг и пудровые оттенки' },
  { id: 'editorial', name: 'Наша история', category: 'Редакционный', color: '#dfd5d4', description: 'Обложка журнала о вашей любви' },
  { id: 'boarding', name: 'Рейс в счастье', category: 'Путешествия', color: '#d9e2e4', description: 'Иллюминатор и билет в новую жизнь' },
  { id: 'vow', name: 'Тихое «да»', category: 'Минимализм', color: '#e7dfd1', description: 'Чистые линии и тёплая бумага' },
  { id: 'olive', name: 'Оливковая ветвь', category: 'Ботаника', color: '#e1e5da', description: 'Нежная графика в природных оттенках' },
  { id: 'arch', name: 'Нежная арка', category: 'Романтика', color: '#e9d8d3', description: 'Пудровые тона и мягкая геометрия' },
  { id: 'clay', name: 'Тёплая терракота', category: 'Минимализм', color: '#ebd8c9', description: 'Южное солнце и фактура земли' },
  { id: 'blue', name: 'Французский сад', category: 'Романтика', color: '#dce2ea', description: 'Тонкие линии и фарфоровый синий' },
  { id: 'noir', name: 'Вечер в шёлке', category: 'Классика', color: '#b9c1b8', description: 'Глубокий зелёный и оттенок шампанского' },
];
export const PRINT_FIELDS = [
  { key: 'groom', label: 'Имя жениха', max: 24 }, { key: 'bride', label: 'Имя невесты', max: 24 },
  { key: 'date', label: 'Дата свадьбы', max: 10, type: 'date' }, { key: 'time', label: 'Начало торжества', max: 5, type: 'time' },
  { key: 'greeting', label: 'Обращение к гостям', max: 55 }, { key: 'message', label: 'Текст приглашения', max: 220, type: 'textarea' },
  { key: 'venue', label: 'Место торжества', max: 65 }, { key: 'address', label: 'Адрес', max: 90 }, { key: 'footer', label: 'Подпись', max: 75 },
] as const;
export type PrintData = Record<(typeof PRINT_FIELDS)[number]['key'], string>;
export const PRINT_SAMPLE: PrintData = { groom: 'Александр', bride: 'Анастасия', date: '2027-06-19', time: '16:00', greeting: 'Дорогие родные и друзья!', message: 'Есть моменты, которые хочется разделить с самыми близкими. Приглашаем вас стать частью нашей истории и отпраздновать день нашей свадьбы.', venue: 'Усадьба «Архангельское»', address: 'Московская область, посёлок Архангельское', footer: 'С любовью и в ожидании встречи' };
export interface PrintOrder { id: string; templateId: string; data: PrintData; status: string; paymentStatus?: string }
