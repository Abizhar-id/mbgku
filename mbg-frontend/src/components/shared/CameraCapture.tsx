'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import type { AspectRatio } from '@/lib/camera';

export interface CameraCaptureProps {
  /**
   * Dipanggil dengan blob foto. Boleh mengembalikan Promise — bila Promise
   * reject (mis. upload gagal), CameraCapture TIDAK menutup; foto dipertahankan
   * dan pesan error + tombol "Coba Lagi" ditampilkan.
   */
  onCapture: (blob: Blob) => void | Promise<void>;
  onCancel:  () => void;
  label?:    string;
  aspectRatio?: AspectRatio;
}

type Status =
  | 'idle'
  | 'requesting'
  | 'previewing'
  | 'capturing'
  | 'confirming'
  | 'uploading'
  | 'upload_error'
  | 'error';

type ErrKind = 'permission_denied' | 'unavailable' | 'unknown';

const ERR: Record<ErrKind, { title: string; body: string; hint: string | null }> = {
  permission_denied: {
    title: 'Akses kamera ditolak',
    body:  'Izinkan akses kamera untuk situs ini melalui pengaturan browser, lalu muat ulang halaman.',
    hint:  'Di Chrome: klik ikon kunci di bilah alamat → Izin situs → Kamera → Izinkan.',
  },
  unavailable: {
    title: 'Kamera tidak tersedia',
    body:  'Perangkat ini tidak memiliki kamera yang dapat digunakan.',
    hint:  null,
  },
  unknown: {
    title: 'Gagal mengakses kamera',
    body:  'Terjadi kesalahan saat membuka kamera. Coba muat ulang halaman.',
    hint:  null,
  },
};

function classify(err: unknown): ErrKind {
  if (!(err instanceof Error)) return 'unknown';
  if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') return 'permission_denied';
  if (['NotFoundError','DevicesNotFoundError','NotReadableError','TrackStartError','OverconstrainedError'].includes(err.name)) return 'unavailable';
  return 'unknown';
}

// Target final size ≤ 350 KB — try quality 0.9 first, fall back to 0.75
async function compressBlob(canvas: HTMLCanvasElement, targetBytes = 350_000): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error('toBlob failed')); return; }
      if (blob.size <= targetBytes) { resolve(blob); return; }
      // Try lower quality
      canvas.toBlob((blob2) => {
        resolve(blob2 ?? blob);
      }, 'image/jpeg', 0.75);
    }, 'image/jpeg', 0.9);
  });
}

function Spinner({ color = '#FFFFFF' }: { color?: string }) {
  return (
    <svg className="w-8 h-8 animate-spin" style={{ color }} fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
    </svg>
  );
}

export default function CameraCapture({
  onCapture,
  onCancel,
  label = 'Ambil Foto',
  aspectRatio = '4:3',
}: CameraCaptureProps) {
  const [status,    setStatus]    = useState<Status>('idle');
  const [errKind,   setErrKind]   = useState<ErrKind>('unknown');
  const [uploadErr, setUploadErr] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const videoRef   = useRef<HTMLVideoElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const streamRef  = useRef<MediaStream | null>(null);
  const blobRef    = useRef<Blob | null>(null);   // foto terakhir, untuk retry upload

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => stopStream(), [stopStream]);

  const startCamera = useCallback(async () => {
    setStatus('requesting');
    try {
      // Cek apakah ada kamera belakang
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      const hasBackCamera = videoDevices.some(d =>
        d.label.toLowerCase().includes('back') ||
        d.label.toLowerCase().includes('rear') ||
        d.label.toLowerCase().includes('environment')
      );

      // Kalau ada kamera belakang → pakai environment, kalau tidak → pakai apapun
      const constraints: MediaStreamConstraints = hasBackCamera
        ? { video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }
        : { video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false };

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
        .catch(() => navigator.mediaDevices.getUserMedia({ video: true, audio: false }));

      streamRef.current = stream;
      setStatus('previewing');

      // Tunggu React render <video> element, baru assign stream
      setTimeout(() => {
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        video.play().catch(() => {});
      }, 50);
    } catch (err) {
      setErrKind(classify(err));
      setStatus('error');
    }
  }, []);

  const capture = useCallback(() => {
    if (status !== 'previewing') return;
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    if (video.videoWidth === 0 || video.videoHeight === 0) return; // not ready yet

    setStatus('capturing');

    // Gambar frame dari video yang MASIH live ke canvas dulu, BARU hentikan stream.
    // Kalau stream di-stop sebelum drawImage, frame video hilang → hasil hitam pekat.
    requestAnimationFrame(() => {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const ratio = aspectRatio === '16:9' ? 16/9 : aspectRatio === '1:1' ? 1 : 4/3;

      let sx=0, sy=0, sw=vw, sh=vh;
      const vRatio = vw / vh;
      if (vRatio > ratio) { sw = vh * ratio; sx = (vw - sw) / 2; }
      else if (vRatio < ratio) { sh = vw / ratio; sy = (vh - sh) / 2; }

      const outW = 1280;
      const outH = Math.round(outW / ratio);
      canvas.width  = outW;
      canvas.height = outH;
      canvas.getContext('2d')?.drawImage(video, sx, sy, sw, sh, 0, 0, outW, outH);

      // Frame sudah tersalin ke canvas → sekarang aman matikan kamera.
      stopStream();

      const url = canvas.toDataURL('image/jpeg', 0.8);
      setPreviewUrl(url);
      setStatus('confirming');
    });
  }, [status, aspectRatio, stopStream]);

  // Jalankan onCapture; bila gagal (Promise reject), tetap buka & tawarkan retry.
  const runUpload = useCallback(async (blob: Blob) => {
    setStatus('uploading');
    setUploadErr('');
    try {
      await onCapture(blob);
      // Sukses → reset & tutup
      setStatus('idle');
      setPreviewUrl(null);
      blobRef.current = null;
    } catch (e: unknown) {
      setUploadErr(e instanceof Error ? e.message : 'Gagal mengunggah foto.');
      setStatus('upload_error');
    }
  }, [onCapture]);

  const confirmPhoto = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setStatus('uploading');
    try {
      const blob = await compressBlob(canvas);
      blobRef.current = blob;
      await runUpload(blob);
    } catch {
      setErrKind('unknown');
      setStatus('error');
    }
  }, [runUpload]);

  const retryUpload = useCallback(() => {
    if (blobRef.current) runUpload(blobRef.current);
  }, [runUpload]);

  const retake = useCallback(async () => {
    setPreviewUrl(null);
    await startCamera();
  }, [startCamera]);

  const handleCancel = useCallback(() => {
    stopStream();
    setStatus('idle');
    setPreviewUrl(null);
    setUploadErr('');
    blobRef.current = null;
    onCancel();
  }, [stopStream, onCancel]);

  const isOpen = !['idle'].includes(status);

  return (
    <>
      {/* Trigger button */}
      {status === 'idle' && (
        <button type="button" onClick={startCamera}
          className="btn-primary inline-flex items-center gap-2 px-4"
          style={{ fontSize: '14px', height: '44px' }}
          aria-label={label}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
          </svg>
          {label}
        </button>
      )}

      {/* Full-screen modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col"
          style={{ backgroundColor: '#000' }}
          role="dialog" aria-modal="true" aria-label="Kamera"
        >
          {/* Requesting */}
          {status === 'requesting' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
              <Spinner />
              <p style={{ color: '#fff', fontSize: '14px' }}>Meminta izin kamera…</p>
              <button type="button" onClick={handleCancel}
                className="mt-2 rounded-xl px-4 py-2"
                style={{ color: '#fff', fontSize: '13px', border: '1px solid rgba(255,255,255,0.3)' }}>
                Batal
              </button>
            </div>
          )}

          {/* Previewing / capturing */}
          {(status === 'previewing' || status === 'capturing') && (
            <>
              <div className="flex-1 relative overflow-hidden">
                {/* iOS needs playsInline + muted + autoPlay as attributes */}
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video
                  ref={videoRef}
                  autoPlay playsInline muted
                  className="absolute inset-0 w-full h-full object-cover"
                  aria-label="Pratinjau kamera"
                />
                {status === 'capturing' && (
                  <div className="absolute inset-0 flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(255,255,255,0.35)' }} aria-hidden="true">
                    <Spinner />
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between px-8 py-6" style={{ backgroundColor: '#000' }}>
                <button type="button" onClick={handleCancel} disabled={status === 'capturing'}
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ border: '1px solid rgba(255,255,255,0.4)', color: '#fff' }} aria-label="Batal">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
                <button type="button" onClick={capture} disabled={status === 'capturing'}
                  className="rounded-full flex items-center justify-center transition-transform active:scale-95"
                  style={{ width: '72px', height: '72px', border: '4px solid #fff', background: 'transparent' }}
                  aria-label="Ambil foto">
                  <div className="rounded-full" style={{ width: '56px', height: '56px', backgroundColor: '#fff' }} />
                </button>
                <div className="w-10 h-10" aria-hidden="true" />
              </div>
            </>
          )}

          {/* Confirming */}
          {status === 'confirming' && previewUrl && (
            <>
              <div className="flex-1 relative overflow-hidden" style={{ backgroundColor: '#111' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt="Foto yang diambil"
                  className="absolute inset-0 w-full h-full object-contain" />
              </div>
              <div className="flex items-center justify-center gap-4 px-6 py-6" style={{ backgroundColor: '#000' }}>
                <button type="button" onClick={retake} className="flex-1 rounded-xl py-3 font-medium"
                  style={{ border: '1px solid rgba(255,255,255,0.4)', color: '#fff', fontSize: '14px', maxWidth: '160px' }}
                  aria-label="Ulangi foto">
                  Ulangi
                </button>
                <button type="button" onClick={confirmPhoto} className="flex-1 rounded-xl py-3 font-semibold"
                  style={{ backgroundColor: 'var(--green)', color: 'var(--navy)', fontSize: '14px', maxWidth: '160px' }}
                  aria-label="Gunakan foto ini">
                  Gunakan Foto
                </button>
              </div>
            </>
          )}

          {/* Uploading */}
          {status === 'uploading' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
              <Spinner color="var(--green)" />
              <p style={{ color: '#fff', fontSize: '14px' }}>Mengompres & mengunggah foto…</p>
            </div>
          )}

          {/* Upload gagal — foto dipertahankan, tawarkan retry (tanpa retake) */}
          {status === 'upload_error' && (
            <>
              <div className="flex-1 relative overflow-hidden" style={{ backgroundColor: '#111' }}>
                {previewUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt="Foto yang diambil"
                    className="absolute inset-0 w-full h-full object-contain" />
                )}
              </div>
              <div className="flex flex-col gap-3 px-6 py-5" style={{ backgroundColor: '#000' }}>
                {/* Pesan error merah — konsisten dgn komponen error lain */}
                <div className="rounded-xl px-4 py-3 text-sm"
                  style={{ backgroundColor: 'var(--status-late-bg)', color: 'var(--status-late-text)' }}
                  role="alert">
                  {uploadErr || 'Gagal mengunggah foto.'}
                </div>
                <div className="flex items-center justify-center gap-4">
                  <button type="button" onClick={retake} className="flex-1 rounded-xl py-3 font-medium"
                    style={{ border: '1px solid rgba(255,255,255,0.4)', color: '#fff', fontSize: '14px', maxWidth: '160px' }}
                    aria-label="Ambil ulang foto">
                    Ambil Ulang
                  </button>
                  <button type="button" onClick={retryUpload} className="flex-1 rounded-xl py-3 font-semibold"
                    style={{ backgroundColor: 'var(--green)', color: 'var(--navy)', fontSize: '14px', maxWidth: '160px' }}
                    aria-label="Coba unggah lagi">
                    Coba Lagi
                  </button>
                </div>
                <button type="button" onClick={handleCancel}
                  className="text-center text-sm py-1"
                  style={{ color: 'rgba(255,255,255,0.6)' }}>
                  Batal
                </button>
              </div>
            </>
          )}

          {/* Error */}
          {status === 'error' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6 text-center">
              <div className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'rgba(198,40,40,0.2)' }}>
                <svg className="w-7 h-7" style={{ color: '#E05050' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold mb-1" style={{ color: '#fff', fontSize: '16px' }}>
                  {ERR[errKind].title}
                </p>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', lineHeight: '1.5' }}>
                  {ERR[errKind].body}
                </p>
              </div>
              {ERR[errKind].hint && (
                <div className="rounded-xl px-4 py-3 w-full max-w-sm"
                  style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}>
                  <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', lineHeight: '1.6' }}>
                    {ERR[errKind].hint}
                  </p>
                </div>
              )}
              <button type="button" onClick={handleCancel}
                className="mt-2 rounded-xl px-6 py-2.5 font-medium"
                style={{ border: '1px solid rgba(255,255,255,0.4)', color: '#fff', fontSize: '14px' }}>
                Tutup
              </button>
            </div>
          )}
        </div>
      )}

      {/* Hidden canvas — capture frame */}
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
    </>
  );
}
