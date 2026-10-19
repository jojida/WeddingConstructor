// Отправка SMS через SMS Aero (https://smsaero.ru/integration/documentation/api/).
//
// Env: SMSAERO_EMAIL, SMSAERO_API_KEY — логин и API-ключ кабинета; SMSAERO_SIGN — имя
// отправителя (своё нужно зарегистрировать у операторов, без него — общее «SMS Aero»).
// Пока ключей нет, SMS не уходят: на разработке они пишутся в консоль (пробный режим),
// на проде анкета телефон не спрашивает — напоминания идут только в Telegram.
// SMS_DRY_RUN=1 включает пробный режим и на проде, SMS_DRY_RUN=0 выключает его везде.

export interface SmsResult { ok: boolean; dry?: boolean; id?: string }

export const smsConfigured = (): boolean => !!(process.env.SMSAERO_EMAIL && process.env.SMSAERO_API_KEY);

export function smsDryRun(): boolean {
  if (smsConfigured()) return false;
  const flag = process.env.SMS_DRY_RUN;
  return flag === '1' || (flag !== '0' && process.env.NODE_ENV !== 'production');
}

/** Можно ли сейчас обещать гостю SMS. */
export const smsAvailable = (): boolean => smsConfigured() || smsDryRun();

/** Длина в частях: кириллица — 70 знаков в одной SMS, 67 в каждой части длинной. */
export function smsParts(text: string): number {
  const n = [...text].length;
  return n <= 70 ? 1 : Math.ceil(n / 67);
}

/** Номер в виде 79XXXXXXXXX. Не бросает: сбой — ok: false (ошибка уже в логе, без номера). */
export async function sendSms(phone: string, text: string): Promise<SmsResult> {
  if (!/^79\d{9}$/.test(phone)) return { ok: false };
  if (!smsConfigured()) {
    if (!smsDryRun()) return { ok: false };
    console.log(`📱 [SMS, пробный режим] +${phone.slice(0, 4)}…${phone.slice(-2)}: ${text}`);
    return { ok: true, dry: true };
  }
  try {
    const auth = Buffer.from(`${process.env.SMSAERO_EMAIL}:${process.env.SMSAERO_API_KEY}`).toString('base64');
    const res = await fetch('https://gate.smsaero.ru/v2/sms/send', {
      method: 'POST',
      signal: AbortSignal.timeout(15_000),
      redirect: 'error',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
      body: JSON.stringify({ number: phone, text, sign: process.env.SMSAERO_SIGN || 'SMS Aero' }),
    });
    const json: any = await res.json().catch(() => null);
    if (!res.ok || json?.success !== true) {
      // message — описание ошибки от SMS Aero (баланс, подпись), номера в нём нет
      console.error('SMS Aero: отправка не удалась', res.status, typeof json?.message === 'string' ? json.message.slice(0, 200) : '');
      return { ok: false };
    }
    const data = Array.isArray(json.data) ? json.data[0] : json.data;
    return { ok: true, id: data?.id != null ? String(data.id) : undefined };
  } catch (e) {
    console.error('SMS Aero: нет ответа', e instanceof Error ? e.name : 'Error');
    return { ok: false };
  }
}
