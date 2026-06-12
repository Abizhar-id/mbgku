// ── menu.ts ───────────────────────────────────────────────────────
import type { MenuResponse, MenuUpload } from '@/types/api';
import { apiFetch, authHeader } from './base';

export const fetchMenuWeekly = (sppgId: number): Promise<MenuResponse[]> =>
  apiFetch(`/menu/${sppgId}`);

export const fetchMenuToday = (sppgId: number): Promise<MenuResponse> =>
  apiFetch(`/menu/${sppgId}/today`);

export const uploadMenuToday = (body: MenuUpload): Promise<MenuResponse> =>
  apiFetch('/menu/today', {
    method: 'POST',
    headers: authHeader(),
    body: JSON.stringify(body),
  });
