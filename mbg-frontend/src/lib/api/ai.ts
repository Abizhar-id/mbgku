import type { RekapAI } from '@/types/ai';
import { apiFetch, authHeader } from './base';

// Endpoint publik HANYA membaca cache. Bila rekap belum tersedia, backend membalas
// HTTP 202 dengan body `{ cached: false, message }` (tanpa field `summary`). Di sini
// kasus itu dipetakan ke `null` → halaman menampilkan state "Rekap belum tersedia"
// (bukan error). Qwen tidak pernah dipanggil dari request publik.
type RecapOrPending = RekapAI | { cached: false; message: string };

function narrow(data: RecapOrPending): RekapAI | null {
  return 'summary' in data ? data : null;
}

// `auth` → sertakan Authorization header (dipakai dari dashboard operator).
export const fetchAIRecap = async (sppgId: number, auth = false): Promise<RekapAI | null> =>
  narrow(await apiFetch<RecapOrPending>(`/ai/recap/${sppgId}`, auth ? { headers: authHeader() } : undefined));

export const fetchAIRecapMonthly = async (sppgId: number, auth = false): Promise<RekapAI | null> =>
  narrow(await apiFetch<RecapOrPending>(`/ai/recap/${sppgId}/monthly`, auth ? { headers: authHeader() } : undefined));
