import { trackPageView } from '@/lib/metrika';

// Never initialise third-party analytics on guest invitations, authentication,
// payments, or the dashboard. Query strings and fragments are never transmitted.
try { trackPageView(window.location.href); } catch { /* Analytics is optional. */ }

export function onRouterTransitionStart(url: string): void {
  trackPageView(url);
}
