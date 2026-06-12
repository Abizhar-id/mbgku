'use client';

import { use, useEffect, useState } from 'react';
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
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ backgroundColor: 'var(--bg-page)' }}>
      <div className="w-full rounded-2xl p-6" style={{ maxWidth: '400px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>

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
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: 'var(--green-light)' }}>
              <svg className="w-7 h-7" style={{ color: 'var(--green-text)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Terima kasih!</p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Feedback kamu sudah tersimpan.</p>
          </div>
        )}

        {status === 'ready' && form && (
          <>
            <h1 className="font-bold mb-1" style={{ color: 'var(--navy)', fontSize: '18px' }}>Beri Penilaian</h1>
            {/* Nama sekolah — terkunci */}
            <div className="rounded-xl px-3 py-2 mb-4" style={{ backgroundColor: 'var(--bg-surface)' }}>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Sekolah</p>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{form.school_name}</p>
            </div>

            {/* Rating bintang */}
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Rating</p>
            <div className="flex gap-2 mb-4 justify-center">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} onClick={() => setRating(s)} aria-label={`${s} bintang`}>
                  <svg className="w-9 h-9 transition-transform active:scale-90"
                    style={{ color: s <= rating ? 'var(--gold)' : 'var(--border)' }}
                    fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </button>
              ))}
            </div>

            {/* Komentar */}
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Komentar (opsional)</p>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              placeholder="Bagaimana makanannya hari ini?"
              className="w-full rounded-xl px-3 py-2 text-sm resize-none mb-3"
              style={{ border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }}
            />

            {error && (
              <p className="text-xs px-3 py-2 rounded-lg mb-3" style={{ backgroundColor: 'var(--status-late-bg)', color: 'var(--status-late-text)' }}>{error}</p>
            )}

            <button onClick={handleSubmit} disabled={sending}
              className="btn-primary w-full py-2.5 text-sm font-medium rounded-xl"
              style={{ opacity: sending ? 0.6 : 1 }}>
              {sending ? 'Mengirim…' : 'Kirim Feedback'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
