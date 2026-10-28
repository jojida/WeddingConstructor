import { trackPageErrors, trackPageView } from '@/lib/metrika';

// Analytics never runs on guest invitations or the dashboard. Funnel pages
// (editor, auth, payment) are counted by path only; of the query string only
// marketing tags (utm_*, yclid) are kept — see analyticsPageUrl in lib/metrika.
try { trackPageView(window.location.href); trackPageErrors(); } catch { /* Analytics is optional. */ }

export function onRouterTransitionStart(url: string): void {
  trackPageView(url);
}
