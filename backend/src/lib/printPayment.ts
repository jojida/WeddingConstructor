import prisma from './prisma';
import { PRINT_PRICE } from './printDesign';

export async function confirmPrintPayment(payment: { id: string; status: string; paid: boolean; amount?: { value: string; currency: string }; metadata?: { product?: string; printOrderId?: string; paymentKey?: string } }) {
  if (payment.status !== 'succeeded' || !payment.paid || payment.metadata?.product !== 'print' || payment.amount?.currency !== 'RUB' || payment.amount.value !== PRINT_PRICE.toFixed(2)) return false;
  const order = await prisma.printOrder.findUnique({ where: { id: payment.metadata.printOrderId || '' } });
  if (!order || order.paymentKey !== payment.metadata.paymentKey || (order.paymentId && order.paymentId !== payment.id)) return false;
  await prisma.printOrder.updateMany({ where: { id: order.id, status: { not: 'paid' }, paymentKey: order.paymentKey }, data: { status: 'paid', paidAt: new Date(), paymentId: payment.id } });
  return true;
}
