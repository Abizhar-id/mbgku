import type { SPPG, SPPGProfile, ProcessTimeline } from '@/types/sppg';
import { apiFetch } from './base';

export const fetchSPPGList = (): Promise<SPPG[]> =>
  apiFetch('/sppg/leaderboard');

export const fetchSPPGProfile = (id: number): Promise<SPPGProfile> =>
  apiFetch(`/sppg/${id}`);

export const fetchProcessTimeline = (sppgId: number): Promise<ProcessTimeline> =>
  apiFetch(`/process/${sppgId}`);