'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredToken, getStoredRole } from '@/lib/api/auth';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    // Hanya admin yang boleh masuk. Token + role disimpan saat login terpadu (/login).
    if (!getStoredToken() || getStoredRole() !== 'admin') router.replace('/login');
  }, [router]);

  return <>{children}</>;
}
