import type { SchoolQR, ValidateQRResponse } from '@/types/api';
import { apiFetch, authHeader } from './base';

export const fetchMyQR = (): Promise<SchoolQR[]> =>
  apiFetch('/qr/my', { headers: authHeader() });

export const validateQR = (token: string): Promise<ValidateQRResponse> =>
  apiFetch(`/qr/validate/${token}`);