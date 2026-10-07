import { PaymentAttempt } from '@prisma/client';
import crypto from 'crypto';
import prisma from './prisma';
import { kassaRequest, paymentIdValid } from './paymentGateway';

export class PaymentConflict extends Error {}

/** The unique product index serializes reservations across processes. */
export async function reservePaymentAttempt(input: {
  invitationId?: string; printOrderId?: string; key?: string; plan?: string;
  amountKopecks: number; payload: (key: string) => unknown;
}): Promise<PaymentAttempt> {
  const where = input.invitationId ? { invitationId: input.invitationId } : { printOrderId: input.printOrderId! };
  const existing = await prisma.paymentAttempt.findUnique({ where });
  if (existing) return existing;
  const id = input.key || crypto.randomUUID();
  try {
    return await prisma.paymentAttempt.create({ data: {
      id, invitationId: input.invitationId, printOrderId: input.printOrderId,
      plan: input.plan || '', amountKopecks: input.amountKopecks,
      payload: JSON.stringify(input.payload(id)),
    } });
  } catch (error: any) {
    if (error?.code !== 'P2002') throw error;
    const winner = await prisma.paymentAttempt.findUnique({ where });
    if (!winner) throw error;
    return winner;
  }
}

export async function requestAttemptPayment(attempt: PaymentAttempt) {
  if (attempt.paymentId) return kassaRequest('GET', `/payments/${attempt.paymentId}`);
  // YooKassa deduplicates for 24 h only. Never replay an uncertain request
  // outside that window: a late retry could charge the buyer a second time.
  if (Date.now() - attempt.createdAt.getTime() > 23 * 60 * 60_000) {
    throw new PaymentConflict('Предыдущий платёж требует проверки. Обратитесь в поддержку, чтобы исключить повторное списание.');
  }
  const payment = await kassaRequest('POST', '/payments', JSON.parse(attempt.payload), attempt.id);
  if (!paymentIdValid(payment?.id)) throw new Error('Invalid gateway payment');
  await prisma.$transaction(async tx => {
    const saved = await tx.paymentAttempt.updateMany({ where: { id: attempt.id, paymentId: { in: ['', payment.id] } }, data: { paymentId: payment.id } });
    if (!saved.count) throw new PaymentConflict('Статус платежа изменился. Обновите страницу.');
    if (attempt.invitationId) await tx.invitation.update({ where: { id: attempt.invitationId }, data: { paymentId: payment.id } });
    if (attempt.printOrderId) await tx.printOrder.update({ where: { id: attempt.printOrderId }, data: { paymentId: payment.id } });
  });
  return payment;
}
