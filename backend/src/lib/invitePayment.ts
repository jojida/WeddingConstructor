import { Invitation, PaymentAttempt } from '@prisma/client';
import prisma from './prisma';
import { PLANS, isPaid, planPriceDue } from './plans';
import { paymentAmountMatches } from './paymentGateway';

export function promoPercent(code: unknown): number | null {
  if (typeof code !== 'string' || !code.trim() || code.length > 64) return null;
  const wanted = code.trim().toUpperCase();
  for (const pair of (process.env.PROMO_CODES || '').split(',')) {
    const [name, value] = pair.split(':').map(s => s.trim());
    const percent = Number(value);
    if (name.toUpperCase() === wanted && Number.isFinite(percent) && percent >= 1 && percent <= 90) return percent;
  }
  return null;
}

export function matchesInvitationPayment(payment: any, invite: Invitation, attempt: PaymentAttempt | null): boolean {
  const plan = payment?.metadata?.plan;
  if (plan !== 'premium' && plan !== 'maximum') return false;
  if (payment.metadata.inviteId !== invite.id) return false;
  if (attempt) {
    return payment.metadata.product === 'website' && payment.metadata.paymentKey === attempt.id
      && plan === attempt.plan && (!attempt.paymentId || attempt.paymentId === payment.id)
      && paymentAmountMatches(payment, attempt.amountKopecks);
  }
  // Legacy pending payments require the stored id and independently computed price.
  if (!invite.paymentId || invite.paymentId !== payment.id || payment.metadata.product || payment.metadata.paymentKey) return false;
  // A legacy plan already granted in the database needs no new entitlement.
  // Its historical price may differ from today's price; permit an upgrade
  // after verifying this is the same settled payment, without re-granting it.
  if (isPaid(invite.status) && invite.plan === plan && payment.status === 'succeeded' && payment.paid === true) {
    const historicalAmount = Number(payment.amount?.value) * 100;
    return Number.isSafeInteger(historicalAmount) && historicalAmount > 0 && paymentAmountMatches(payment, historicalAmount);
  }
  let amount = planPriceDue(plan, invite.plan, isPaid(invite.status));
  if (payment.metadata.promoCode) {
    const percent = promoPercent(payment.metadata.promoCode);
    if (percent === null) return false;
    amount = Math.round(amount * (100 - percent) / 100);
  }
  return amount > 0 && paymentAmountMatches(payment, amount);
}

/** Called only with an object independently retrieved from the gateway API. */
export async function confirmInvitationPayment(payment: any): Promise<boolean> {
  if (payment?.status !== 'succeeded' || payment.paid !== true || typeof payment.metadata?.inviteId !== 'string') return false;
  return prisma.$transaction(async tx => {
    const invite = await tx.invitation.findUnique({ where: { id: payment.metadata.inviteId } });
    if (!invite) return false;
    const attempt = await tx.paymentAttempt.findUnique({ where: { invitationId: invite.id } });
    if (!matchesInvitationPayment(payment, invite, attempt)) return false;
    const target = payment.metadata.plan as 'premium' | 'maximum';
    const current = Object.prototype.hasOwnProperty.call(PLANS, invite.plan) ? PLANS[invite.plan as keyof typeof PLANS].rank : 1;
    if (isPaid(invite.status) && current > PLANS[target].rank) return false;
    if (isPaid(invite.status) && invite.plan === target) return true;
    const updated = await tx.invitation.updateMany({
      where: { id: invite.id, paymentId: invite.paymentId, plan: invite.plan, status: invite.status },
      data: { status: 'paid', plan: target, paidAt: new Date(), paymentId: payment.id },
    });
    if (updated.count && attempt) await tx.paymentAttempt.update({ where: { id: attempt.id }, data: { paymentId: payment.id } });
    return updated.count === 1;
  });
}
