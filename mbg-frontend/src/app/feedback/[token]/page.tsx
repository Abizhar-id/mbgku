'use client';

import { use, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { fetchFeedbackForm, submitFeedback } from '@/lib/api/feedback';
import type { FeedbackForm } from '@/types/feedback';

type Status = 'loading' | 'ready' | 'closed' | 'invalid' | 'submitted';

function Spinner() {
  return (
    <svg className="w-8 h-8 animate-spin" style={{ color: 'var(--navy)' }} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
    </svg>
  );
}

export default function FeedbackPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  const [status,  setStatus]  = useState<Status>('loading');
  const [form,    setForm]    = useState<FeedbackForm | null>(null);
  const [rating,  setRating]  = useState(0);
  const [comment, setComment] = useState('');
  const [error,   setError]   = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchFeedbackForm(token)
      .then((f) => {
        setForm(f);
        setStatus(f.open ? 'ready' : 'closed');
      })
      .catch(() => setStatus('invalid'));
  }, [token]);

  const handleSubmit = async () => {
    if (rating < 1) { setError('Pilih rating bintang dulu.'); return; }
    setSending(true);
    setError(null);
    try {
      await submitFeedback(token, { rating, comment: comment.trim() || undefined });
      setStatus('submitted');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal mengirim feedback.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-gradient-navy">
      <motion.div
        className="w-full rounded-2xl p-8"
        style={{ maxWidth: '420px', backgroundColor: 'var(--bg-card)', boxShadow: '0 20px 50px rgba(0,0,0,0.35)' }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >

        {status === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-8"><Spinner /><p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Memvalidasi QR…</p></div>
        )}

        {status === 'invalid' && (
          <div className="text-center py-6">
            <p className="font-semibold mb-1" style={{ color: 'var(--status-late-text)' }}>QR tidak valid</p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>QR tidak dikenali atau sudah tidak berlaku.</p>
          </div>
        )}

        {status === 'closed' && form && (
          <div className="text-center py-6">
            <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Form belum dibuka</p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{form.message}</p>
          </div>
        )}

        {status === 'submitted' && (
          <div className="text-center py-6">
            <motion.div
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: 'var(--green-light)' }}
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            >
              <svg className="w-10 h-10" style={{ color: 'var(--green-text)' }} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </motion.div>
            <p className="font-bold mb-1" style={{ color: 'var(--text-primary)', fontSize: '18px' }}>Terima kasih!</p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Feedback kamu sudah tersimpan.</p>
          </div>
        )}

        {status === 'ready' && form && (
          <>
            <h1 className="font-bold mb-3 text-center" style={{ color: 'var(--navy)', fontSize: '22px', letterSpacing: '-0.01em' }}>Beri Penilaian</h1>
            {/* Nama sekolah — badge navy */}
            <div className="rounded-xl px-4 py-3 mb-5 text-center bg-gradient-navy">
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>Sekolah</p>
              <p className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>{form.school_name}</p>
            </div>

            {/* Rating bintang */}
            <p className="text-xs font-semibold mb-2 text-center" style={{ color: 'var(--text-secondary)' }}>Ketuk bintang untuk menilai</p>
            <div className="flex gap-2 mb-5 justify-center">
              {[1, 2, 3, 4, 5].map((s) => (
                <motion.button key={s} onClick={() => setRating(s)} aria-label={`${s} bintang`}
                  whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.85 }}>
                  <svg className="w-10 h-10"
                    style={{ color: s <= rating ? 'var(--gold)' : 'var(--border)', transition: 'color 150ms ease' }}
                    fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </motion.button>
              ))}
            </div>

            {/* Komentar */}
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Komentar (opsional)</p>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              placeholder="Bagaimana makanannya hari ini?"
              className="field px-3.5 py-2.5 text-sm resize-none mb-3"
            />

            {error && (
              <p className="text-xs px-3 py-2 rounded-lg mb-3" style={{ backgroundColor: 'var(--status-late-bg)', color: 'var(--status-late-text)' }}>{error}</p>
            )}

            <button onClick={handleSubmit} disabled={sending}
              className="btn-primary w-full text-sm"
              style={{ height: '46px', opacity: sending ? 0.6 : 1 }}>
              {sending ? 'Mengirim…' : 'Kirim Feedback'}
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}
