'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import jsQR from 'jsqr';

export interface QRScannerProps {
  /**
   * Dipanggil dengan teks hasil decode QR (mis. URL berisi token). Boleh
   * mengembalikan Promise — bila Promise reject (QR tidak valid / bukan untuk
   * sekolah ini), scanner TIDAK menutup; pesan error + tombol "Pindai Lagi"
   * ditampilkan. Bila resolve, parent diharapkan menutup scanner (mis. pindah
   * ke langkah kamera foto).
   */
  onDetected: (value: string) => void | Promise<void>;
  onCancel: () => void;
  label?: string;
}

type Status = 'idle' | 'requesting' | 'scanning' | 'validating' | 'scan_error' | 'error';
type ErrKind = 'permission_denied' | 'unavailable' | 'unknown';

const ERR: Record<ErrKind, { title: string; body: string; hint: string | null }> = {
  permission_denied: {
    title: 'Akses kamera ditolak',
    body: 'Izinkan akses kamera untuk situs ini melalui pengaturan browser, lalu coba lagi.',
    hint: 'Di Chrome: klik ikon kunci di bilah alamat → Izin situs → Kamera → Izinkan.',
  },
  unavailable: {
    title: 'Kamera tidak tersedia',
    body: 'Perangkat ini tidak memiliki kamera yang dapat digunakan.',
    hint: null,
  },
  unknown: {
    title: 'Gagal mengakses kamera',
    body: 'Terjadi kesalahan saat membuka kamera. Coba muat ulang halaman.',
    hint: null,
  },
};

function classify(err: unknown): ErrKind {
  if (!(err instanceof Error)) return 'unknown';
  if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') return 'permission_denied';
  if (['NotFoundError', 'DevicesNotFoundError', 'NotReadableError', 'TrackStartError', 'OverconstrainedError'].includes(err.name)) return 'unavailable';
  return 'unknown';
}

function Spinner({ color = '#FFFFFF' }: { color?: string }) {
  return (
    <svg className="w-8 h-8 animate-spin" style={{ color }} fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
    </svg>
  );
}

export default function QRScanner({ onDetected, onCancel, label = 'Pindai QR' }: QRScannerProps) {
  const [status, setStatus] = useState<Status>('idle');
  const [errKind, setErrKind] = useState<ErrKind>('unknown');
  const [scanErr, setScanErr] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stoppedRef = useRef(false); // hentikan loop setelah QR ditemukan / batal

  const stopStream = useCallback(() => {
    stoppedRef.current = true;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => stopStream(), [stopStream]);

  // Dipanggil saat QR terdeteksi. Hentikan kamera, lalu serahkan ke parent
  // (validasi backend). Bila parent menolak → tampilkan error + "Pindai Lagi".
  const handleFound = useCallback(async (text: string) => {
    if (stoppedRef.current) return;
    stopStream();
    setStatus('validating');
    try {
      await onDetected(text);
      // sukses → parent akan unmount scanner (pindah ke kamera foto)
    } catch (e) {
      setScanErr(e instanceof Error ? e.message : 'QR tidak valid.');
      setStatus('scan_error');
    }
  }, [onDetected, stopStream]);

  const startCamera = useCallback(async () => {
    setStatus('requesting');
    setScanErr('');
    stoppedRef.current = false;
    try {
      const stream = await navigator.mediaDevices
        .getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
        .catch(() => navigator.mediaDevices.getUserMedia({ video: true, audio: false }));

      streamRef.current = stream;
      setStatus('scanning'); // efek di bawah yang wiring <video> + mulai loop pindai
    } catch (err) {
      setErrKind(classify(err));
      setStatus('error');
    }
  }, []);

  // Loop pindai: aktif hanya saat status 'scanning'. Setiap frame di-decode jsQR.
  useEffect(() => {
    if (status !== 'scanning') return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;

    video.srcObject = stream;
    video.play().catch(() => {});

    let raf = 0;
    const tick = () => {
      if (stoppedRef.current) return;
      const canvas = canvasRef.current;
      if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0 && canvas) {
        const w = video.videoWidth;
        const h = video.videoHeight;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, w, h);
          const img = ctx.getImageData(0, 0, w, h);
          const code = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' });
          if (code && code.data) { handleFound(code.data); return; }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [status, handleFound]);

  const handleCancel = useCallback(() => {
    stopStream();
    setStatus('idle');
    setScanErr('');
    onCancel();
  }, [stopStream, onCancel]);

  // ── Idle: tombol aktifkan kamera (jangan auto-getUserMedia, constraint #2) ──
  if (status === 'idle') {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl p-5 text-center"
        style={{ backgroundColor: 'var(--bg-surface)' }}>
        <div className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'var(--navy-muted)' }} aria-hidden="true">
          <svg className="w-6 h-6" fill="none" stroke="var(--navy)" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-2.25A1.125 1.125 0 0 1 3.75 7.125v-2.25ZM3.75 16.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125v-2.25ZM15.75 4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125v-2.25Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75ZM6.75 18.75h.75v.75h-.75v-.75ZM18.75 6.75h.75v.75h-.75v-.75ZM13.5 13.5h.75v.75h-.75v-.75ZM13.5 19.5h.75v.75h-.75v-.75ZM19.5 13.5h.75v.75h-.75v-.75ZM19.5 19.5h.75v.75h-.75v-.75ZM16.5 16.5h.75v.75h-.75v-.75Z" />
          </svg>
        </div>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Arahkan kamera ke QR pengiriman yang tertempel di sekolah.
        </p>
        <button type="button" onClick={startCamera}
          className="btn-primary w-full py-2.5 text-sm font-medium rounded-xl" aria-label={label}>
          {label}
        </button>
        <button type="button" onClick={onCancel}
          className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          Batal
        </button>
      </div>
    );
  }

  // ── Selain idle: modal full-screen ─────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: '#000' }}
      role="dialog" aria-modal="true" aria-label="Pemindai QR">

      {status === 'requesting' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
          <Spinner />
          <p style={{ color: '#fff', fontSize: '14px' }}>Meminta izin kamera…</p>
          <button type="button" onClick={handleCancel} className="mt-2 rounded-xl px-4 py-2"
            style={{ color: '#fff', fontSize: '13px', border: '1px solid rgba(255,255,255,0.3)' }}>
            Batal
          </button>
        </div>
      )}

      {status === 'scanning' && (
        <>
          <div className="flex-1 relative overflow-hidden">
            <video ref={videoRef} autoPlay playsInline muted
              className="absolute inset-0 w-full h-full object-cover" aria-label="Pratinjau pemindai" />
            {/* Bingkai panduan pindai */}
            <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
              <div style={{
                width: '64vw', maxWidth: '280px', aspectRatio: '1', borderRadius: '20px',
                border: '3px solid rgba(255,255,255,0.9)', boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
              }} />
            </div>
            <p className="absolute left-0 right-0 text-center px-6"
              style={{ bottom: '24px', color: '#fff', fontSize: '13px', textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
              Posisikan QR di dalam bingkai
            </p>
          </div>
          <div className="flex items-center justify-center px-8 py-6" style={{ backgroundColor: '#000' }}>
            <button type="button" onClick={handleCancel} className="rounded-xl px-6 py-2.5 font-medium"
              style={{ border: '1px solid rgba(255,255,255,0.4)', color: '#fff', fontSize: '14px' }}>
              Batal
            </button>
          </div>
        </>
      )}

      {status === 'validating' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
          <Spinner color="var(--green)" />
          <p style={{ color: '#fff', fontSize: '14px' }}>Memvalidasi QR…</p>
        </div>
      )}

      {status === 'scan_error' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6 text-center">
          <div className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'rgba(198,40,40,0.2)' }}>
            <svg className="w-7 h-7" style={{ color: '#E05050' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <p style={{ color: '#fff', fontSize: '15px', lineHeight: '1.5', maxWidth: '320px' }}>{scanErr}</p>
          <div className="flex items-center justify-center gap-4 w-full max-w-sm">
            <button type="button" onClick={handleCancel} className="flex-1 rounded-xl py-3 font-medium"
              style={{ border: '1px solid rgba(255,255,255,0.4)', color: '#fff', fontSize: '14px', maxWidth: '160px' }}>
              Batal
            </button>
            <button type="button" onClick={startCamera} className="flex-1 rounded-xl py-3 font-semibold"
              style={{ backgroundColor: 'var(--green)', color: 'var(--navy)', fontSize: '14px', maxWidth: '160px' }}>
              Pindai Lagi
            </button>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6 text-center">
          <div className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'rgba(198,40,40,0.2)' }}>
            <svg className="w-7 h-7" style={{ color: '#E05050' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold mb-1" style={{ color: '#fff', fontSize: '16px' }}>{ERR[errKind].title}</p>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', lineHeight: '1.5' }}>{ERR[errKind].body}</p>
          </div>
          {ERR[errKind].hint && (
            <div className="rounded-xl px-4 py-3 w-full max-w-sm"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', lineHeight: '1.6' }}>{ERR[errKind].hint}</p>
            </div>
          )}
          <button type="button" onClick={handleCancel} className="mt-2 rounded-xl px-6 py-2.5 font-medium"
            style={{ border: '1px solid rgba(255,255,255,0.4)', color: '#fff', fontSize: '14px' }}>
            Tutup
          </button>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
    </div>
  );
}
