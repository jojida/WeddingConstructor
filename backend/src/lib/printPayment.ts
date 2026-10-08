import prisma from './prisma';
import { PRINT_PRICE } from './printDesign';
import { paymentAmountMatches } from './paymentGateway';

export function matchesPrintPayment(payment: any, order: { id: string; paymentKey: string; paymentId: string }, amountKopecks = PRINT_PRICE * 100): boolean {
  return paymentAmountMatches(payment, amountKopecks) && payment.metadata?.product === 'print'
    && payment.metadata.printOrderId === order.id && payment.metadata.paymentKey === order.paymentKey
    && (!order.paymentId || order.paymentId === payment.id);
}

export async function confirmPrintPayment(payment: any) {
  if (payment?.status !== 'succeeded' || payment.paid !== true || typeof payment.metadata?.printOrderId !== 'string') return false;
  return prisma.$transaction(async tx => {
    const order = await tx.printOrder.findUnique({ where: { id: payment.metadata.printOrderId } });
    if (!order) return false;
    const attempt = await tx.paymentAttempt.findUnique({ where: { printOrderId: order.id } });
    if (!matchesPrintPayment(payment, order, attempt?.amountKopecks)
      || (attempt && (attempt.id !== order.paymentKey || (attempt.paymentId && attempt.paymentId !== payment.id)))) return false;
    if (order.status === 'paid') return true;
    const result = await tx.printOrder.updateMany({ where: { id: order.id, status: { not: 'paid' }, paymentKey: order.paymentKey, paymentId: order.paymentId }, data: { status: 'paid', paidAt: new Date(), paymentId: payment.id } });
    if (result.count && attempt) await tx.paymentAttempt.update({ where: { id: attempt.id }, data: { paymentId: payment.id } });
    return result.count === 1;
  });
}
