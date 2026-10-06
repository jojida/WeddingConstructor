'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { errorText, type PlannerSnapshot } from '@/lib/planner';

export type PlannerLoad = 'loading' | 'ready' | 'plan' | 'beta' | 'error';

/** Состояние раздела «Меню и рассадка». Сервер — единственный источник правды: после каждого
    изменения интерфейс принимает свежий снимок целиком, а не правит свою копию. */
export function usePlanner(inviteId: string) {
  const [snap, setSnap] = useState<PlannerSnapshot | null>(null);
  const [load, setLoad] = useState<PlannerLoad>('loading');
  const [pending, setPending] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  // Первая загрузка (и «Повторить»): заодно приводит людей в соответствие с ответами анкеты
  useEffect(() => {
    let live = true;
    api.post<{ snapshot: PlannerSnapshot }>(`/api/planner/${inviteId}/sync`, {})
      .then((res) => { if (live) { setSnap(res.data.snapshot); setLoad('ready'); } })
      .catch((e) => {
        if (!live) return;
        const r = (e as { response?: { status?: number; data?: { code?: string } } }).response;
        setLoad(r?.status === 403 ? (r.data?.code === 'plan' ? 'plan' : 'beta') : 'error');
      });
    return () => { live = false; };
  }, [inviteId, attempt]);

  const retry = useCallback(() => { setLoad('loading'); setAttempt((n) => n + 1); }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get<PlannerSnapshot>(`/api/planner/${inviteId}`);
      if (alive.current) setSnap(res.data);
    } catch { /* остаётся прежний снимок */ }
  }, [inviteId]);

  /** Изменение. Ошибку сервера показывает по-русски и перечитывает состояние: его могли
      поменять с другой вкладки или телефона. */
  const act = useCallback(async <T = unknown>(method: 'post' | 'put' | 'delete', path: string, body?: unknown): Promise<{ ok: boolean; result?: T }> => {
    setPending((n) => n + 1);
    try {
      const res = await api.request<{ result: T; snapshot: PlannerSnapshot }>({ method, url: `/api/planner/${inviteId}${path}`, data: body });
      if (alive.current) setSnap(res.data.snapshot);
      return { ok: true, result: res.data.result };
    } catch (e) {
      toast.error(errorText(e));
      await refresh();
      return { ok: false };
    } finally {
      if (alive.current) setPending((n) => n - 1);
    }
  }, [inviteId, refresh]);

  return { inviteId, snap, load, pending, act, refresh, retry };
}

export type PlannerCtl = ReturnType<typeof usePlanner>;
