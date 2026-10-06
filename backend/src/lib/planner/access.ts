// Доступ к планировщику (меню и рассадка): тариф + флаг раскрытия.
import prisma from '../prisma';
import { isFreeAccount } from '../freeAccounts';
import { hasPlanner, hasPlannerPrint } from '../plans';

/** Пока в окружении бэкенда нет PLANNER_PUBLIC=1, функция открыта только тестовым
    аккаунтам владельца (см. freeAccounts.ts): её можно выкладывать на прод и проверять
    на настоящих данных, не показывая клиентам. */
export const plannerIsPublic = (): boolean => process.env.PLANNER_PUBLIC === '1';

/** Открыта ли функция этому аккаунту — для подсказки интерфейсу (сервер всё равно проверяет сам). */
export const plannerOpenForEmail = (email: string | null | undefined): boolean =>
  plannerIsPublic() || isFreeAccount(email);

/** null — доступ есть; 'plan' — тариф приглашения не включает функцию; 'beta' — функция
    ещё не открыта этому владельцу. */
export type PlannerDenial = null | 'plan' | 'beta';

async function ownerOpen(userId: string): Promise<boolean> {
  if (plannerIsPublic()) return true;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  return isFreeAccount(user?.email);
}

export async function plannerDenial(invite: { plan: string; userId: string }): Promise<PlannerDenial> {
  if (!hasPlanner(invite.plan)) return 'plan';
  return (await ownerOpen(invite.userId)) ? null : 'beta';
}

/** То же для печати: тариф должен включать печатные материалы. */
export async function plannerPrintDenial(invite: { plan: string; userId: string }): Promise<PlannerDenial> {
  if (!hasPlannerPrint(invite.plan)) return 'plan';
  return (await ownerOpen(invite.userId)) ? null : 'beta';
}

export const DENIAL_TEXT: Record<'plan' | 'beta', string> = {
  plan: 'Меню и рассадка доступны на тарифе «Премиум»',
  beta: 'Меню и рассадка пока открыты не всем — скоро появятся',
};
