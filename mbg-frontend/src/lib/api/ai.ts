import type { RekapAI } from '@/types/ai';
import { apiFetch, authHeader } from './base';

// `auth` → sertakan Authorization header (dipakai dari dashboard operator).
export const fetchAIRecap = (sppgId: number, auth = false): Promise<RekapAI> =>
  apiFetch(`/ai/recap/${sppgId}`, auth ? { headers: authHeader() } : undefined);

export const fetchAIRecapMonthly = (sppgId: number, auth = false): Promise<RekapAI> =>
  apiFetch(`/ai/recap/${sppgId}/monthly`, auth ? { headers: authHeader() } : undefined);