'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { login } from '@/lib/api/auth';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      const msg =
        e instanceof Error ? e.message :
        typeof e === 'string' ? e :
        'Username atau password salah, atau server sedang bermasalah.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-navy">
      <motion.div
        className="w-full rounded-2xl p-8"
        style={{ maxWidth: '400px', backgroundColor: 'var(--bg-card)', boxShadow: '0 20px 50px rgba(0,0,0,0.35)' }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        {/* Logo */}
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 bg-gradient-navy">
          <svg className="w-7 h-7" fill="none" stroke="var(--gold)" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z" />
          </svg>
        </div>

        <h1 className="font-bold mb-1 text-center" style={{ color: 'var(--navy)', fontSize: '24px', letterSpacing: '-0.01em' }}>
          Masuk ke Dashboard SPPG
        </h1>
        <p className="text-sm mb-6 text-center" style={{ color: 'var(--text-secondary)' }}>
          Akses dashboard untuk mengelola data distribusi MBG, status pengiriman, dan laporan monitoring.
        </p>

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--text-secondary)' }}>Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              className="field px-3.5 text-sm"
              style={{ height: '46px' }}
              placeholder="dapur1"
            />
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--text-secondary)' }}>Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                className="field pl-3.5 pr-11 text-sm"
                style={{ height: '46px' }}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5"
                style={{ color: 'var(--text-tertiary)', transition: 'color 0.15s ease' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; }}
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.04 12.32a1 1 0 0 1 0-.64C3.42 7.51 7.36 4.5 12 4.5c4.64 0 8.58 3.01 9.96 7.18a1 1 0 0 1 0 .64C20.58 16.49 16.64 19.5 12 19.5c-4.64 0-8.58-3.01-9.96-7.18Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.58 10.58a2 2 0 0 0 2.83 2.83M9.36 5.18A9.46 9.46 0 0 1 12 4.5c4.64 0 8.58 3.01 9.96 7.18a1 1 0 0 1 0 .64 11.3 11.3 0 0 1-2.17 3.51M6.1 6.1A11.3 11.3 0 0 0 2.04 11.68a1 1 0 0 0 0 .64C3.42 16.49 7.36 19.5 12 19.5a9.5 9.5 0 0 0 3.9-.82" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--status-late-bg)', color: 'var(--status-late-text)' }}>
              {error}
            </p>
          )}

          <button onClick={handleSubmit} disabled={loading}
            className="btn-primary w-full text-sm mt-1 flex items-center justify-center gap-2"
            style={{ height: '46px', opacity: loading ? 0.7 : 1 }}>
            {loading && (
              <svg className="w-4 h-4 animate-spin" style={{ color: '#fff' }} fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
              </svg>
            )}
            {loading ? 'Memproses...' : 'Masuk'}
          </button>

          <Link href="/" className="link-arrow text-xs text-center mt-1 inline-flex items-center justify-center gap-1"
            style={{ color: 'var(--text-tertiary)' }}>
            Kembali ke Beranda
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
