'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { login } from '@/lib/api/auth';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!username.trim() || !password.trim()) {
      setError('Username dan password wajib diisi.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await login({ username, password });
      router.replace(data.role === 'admin' ? '/admin' : '/dashboard');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Login gagal.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ backgroundColor: 'var(--bg-page)' }}>
      <div className="w-full rounded-2xl p-6" style={{ maxWidth: '380px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <h1 className="font-bold mb-1" style={{ color: 'var(--navy)', fontSize: '20px' }}>Login</h1>
        <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>Masuk untuk mengelola data Anda.</p>

        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              className="w-full rounded-xl px-3 py-2.5 text-sm"
              style={{ border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }}
              placeholder="dapur1"
            />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              className="w-full rounded-xl px-3 py-2.5 text-sm"
              style={{ border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--status-late-bg)', color: 'var(--status-late-text)' }}>
              {error}
            </p>
          )}

          <button onClick={handleSubmit} disabled={loading}
            className="btn-primary w-full py-2.5 text-sm font-medium rounded-xl mt-1"
            style={{ opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Memproses…' : 'Masuk'}
          </button>

          <Link href="/" className="text-xs text-center mt-1" style={{ color: 'var(--text-tertiary)' }}>
            ← Kembali ke leaderboard
          </Link>
        </div>
      </div>
    </div>
  );
}
