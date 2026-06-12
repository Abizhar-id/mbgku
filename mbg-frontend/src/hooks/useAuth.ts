// ── useAuth.ts ────────────────────────────────────────────────────
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredToken, getStoredSPPGId } from '@/lib/api/auth';

export function useAuth() {
  const router = useRouter();

  const [mounted,  setMounted]  = useState(false);
  const [token,    setToken]    = useState<string | null>(null);
  const [sppgId,   setSppgId]   = useState<number | null>(null);
  const [sppgName, setSppgName] = useState<string | null>(null);
  const [role,     setRole]     = useState<string | null>(null);

  useEffect(() => {
    const t = getStoredToken();
    const id = getStoredSPPGId();
    const name = localStorage.getItem('sppg_name');
    // Sengaja set state setelah mount: nilai localStorage hanya tersedia di client,
    // pola standar untuk menghindari hydration mismatch (server render kosong dulu).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(t);
    setSppgId(id);
    setSppgName(name);
    setRole(localStorage.getItem('role'));
    setMounted(true);
    if (!t) router.replace('/login');
  }, [router]);

  return { token, sppgId, sppgName, role, mounted };
}
