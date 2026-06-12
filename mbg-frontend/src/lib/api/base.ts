const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

/**
 * Ubah field `detail` dari respons error FastAPI menjadi string yang aman ditampilkan.
 * - string → dipakai apa adanya
 * - array  → error validasi 422; gabung pesan (`msg`) tiap field
 * - object → ambil `.msg` bila ada
 * Mencegah pesan "[object Object]" saat `detail` bukan string.
 */
function parseErrorDetail(err: unknown, status: number): string {
  const detail = (err as { detail?: unknown } | null)?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((d) => (d && typeof d === 'object' && 'msg' in d ? String((d as { msg: unknown }).msg) : String(d)))
      .filter(Boolean);
    if (msgs.length) return msgs.join('; ');
  }
  if (detail && typeof detail === 'object' && typeof (detail as { msg?: unknown }).msg === 'string') {
    return (detail as { msg: string }).msg;
  }
  return `HTTP ${status}`;
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    // headers digabung TERAKHIR supaya 'Content-Type: application/json' tidak
    // tertimpa oleh options.headers (mis. authHeader). Tanpa header ini, body
    // POST terkirim sebagai text/plain → FastAPI gagal parse → 422 "Input should
    // be a valid dictionary or object to extract fields from".
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(parseErrorDetail(err, res.status));
  }

  return res.json();
}

export function authHeader(): { Authorization: string } | Record<string, never> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}
