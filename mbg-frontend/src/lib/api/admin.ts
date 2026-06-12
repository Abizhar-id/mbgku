// ── Admin API ─────────────────────────────────────────────────────
// Login terpadu lewat /login: token admin disimpan di key 'access_token'
// (sama seperti SPPG), dibedakan oleh 'role' === 'admin'. Pakai authHeader().
import type { AdminSchool, GenerateQRResponse } from '@/types/api';
import { authHeader } from './base';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

async function parseError(res: Response): Promise<string> {
  const err = await res.json().catch(() => ({ detail: 'Terjadi kesalahan.' }));
  return err.detail ?? `HTTP ${res.status}`;
}

// ── Schools + QR management ───────────────────────────────────────

export async function fetchAdminSchools(): Promise<AdminSchool[]> {
  const res = await fetch(`${BASE_URL}/admin/schools`, {
    headers: authHeader(),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

async function generateQR(
  schoolId: number,
  kind: 'delivery' | 'feedback',
): Promise<GenerateQRResponse> {
  const res = await fetch(
    `${BASE_URL}/admin/schools/${schoolId}/qr/${kind}/generate`,
    { method: 'POST', headers: authHeader() },
  );
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export const generateDeliveryQR = (schoolId: number) =>
  generateQR(schoolId, 'delivery');

export const generateFeedbackQR = (schoolId: number) =>
  generateQR(schoolId, 'feedback');

async function getQRImage(
  schoolId: number,
  kind: 'delivery' | 'feedback',
): Promise<string> {
  const res = await fetch(
    `${BASE_URL}/admin/schools/${schoolId}/qr/${kind}`,
    { headers: authHeader() },
  );
  if (!res.ok) throw new Error(await parseError(res));
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export const getDeliveryQRImage = (schoolId: number) =>
  getQRImage(schoolId, 'delivery');

export const getFeedbackQRImage = (schoolId: number) =>
  getQRImage(schoolId, 'feedback');
