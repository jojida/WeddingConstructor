const API = 'https://api.yookassa.ru/v3';
const allowsTestPayments = () => process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
export const paymentIdValid = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9-]{1,64}$/.test(value);

export function kassaAuth() {
  const shopId = process.env.YOOKASSA_SHOP_ID || process.env.YUMONEY_SHOP_ID || '';
  const secretKey = process.env.YOOKASSA_SECRET_KEY || process.env.YUMONEY_SECRET_KEY || '';
  const configured = Boolean(shopId && secretKey && shopId !== 'your_shop_id'
    && !(!allowsTestPayments() && secretKey.startsWith('test_')));
  return { shopId, secretKey, configured };
}

export async function kassaRequest(method: 'GET' | 'POST', path: string, body?: unknown, idempotenceKey?: string) {
  const { shopId, secretKey, configured } = kassaAuth();
  if (!configured || !/^\/payments(?:\/[a-zA-Z0-9-]{1,64})?$/.test(path)) throw new Error('Payment gateway unavailable');
  if (method === 'POST' && (!idempotenceKey || !paymentIdValid(idempotenceKey))) throw new Error('A persisted idempotence key is required');
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${shopId}:${secretKey}`).toString('base64'),
      ...(method === 'POST' ? { 'Content-Type': 'application/json', 'Idempotence-Key': idempotenceKey! } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
    redirect: 'error',
  });
  const payment: any = await response.json().catch(() => null);
  if (!response.ok) {
    // Gateway responses may contain receipt email and other personal data.
    console.error(`YooKassa request failed: HTTP ${response.status}`);
    throw new Error('Payment gateway request failed');
  }
  return payment;
}

export function paymentAmountMatches(payment: any, amountKopecks: number): boolean {
  if (!payment || !paymentIdValid(payment.id) || payment.amount?.currency !== 'RUB'
    || payment.amount.value !== (amountKopecks / 100).toFixed(2)) return false;
  if (!allowsTestPayments() && (payment.test !== false || payment.recipient?.account_id !== kassaAuth().shopId)) return false;
  if (payment.recipient?.account_id && payment.recipient.account_id !== kassaAuth().shopId) return false;
  return true;
}

export function paymentRedirect(payment: any): string | null {
  try {
    const value = payment?.confirmation?.confirmation_url;
    if (typeof value !== 'string') return null;
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? value : null;
  } catch { return null; }
}
