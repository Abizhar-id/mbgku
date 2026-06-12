import type { LoginRequest, LoginResponse } from '@/types/api';
import { apiFetch } from './base';

export async function login(body: LoginRequest): Promise<LoginResponse> {
  const data = await apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  // Simpan token + role ke localStorage
  localStorage.setItem('access_token', data.access_token);
  localStorage.setItem('role', data.role);

  if (data.role === 'sppg') {
    localStorage.setItem('sppg_id', String(data.sppg_id));
    localStorage.setItem('sppg_name', data.sppg_name ?? '');
  } else {
    // Admin tidak punya konteks SPPG — bersihkan sisa data SPPG kalau ada.
    localStorage.removeItem('sppg_id');
    localStorage.removeItem('sppg_name');
  }
  return data;
}

export function logout(): void {
  localStorage.removeItem('access_token');
  localStorage.removeItem('role');
  localStorage.removeItem('sppg_id');
  localStorage.removeItem('sppg_name');
}

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
}

export function getStoredSPPGId(): number | null {
  if (typeof window === 'undefined') return null;
  const id = localStorage.getItem('sppg_id');
  return id ? Number(id) : null;
}

export function getStoredRole(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('role');
}