'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { logout } from '@/lib/api/auth';
import { uploadMenuToday, fetchMenuToday } from '@/lib/api/menu';
import { uploadKitchenPhoto } from '@/lib/api/process';
import { fetchMyQR, validateQR } from '@/lib/api/qr';
import { confirmDelivery } from '@/lib/api/delivery';
import { fetchProcessTimeline } from '@/lib/api/sppg';
import { fetchAIRecap, fetchAIRecapMonthly } from '@/lib/api/ai';
import type { MenuResponse, SchoolQR } from '@/types/api';
import type { ProcessTimeline } from '@/types/sppg';
import type { RekapAI } from '@/types/ai';
import CameraCapture from '@/components/shared/CameraCapture';
import QRScanner from '@/components/shared/QRScanner';
import { useRouter } from 'next/navigation';

// QR pengiriman meng-encode URL `.../delivery/confirm/<token>`. Ambil segmen
// terakhir sebagai token. Bila yang dipindai cuma token mentah, kembalikan apa adanya.
function extractToken(decoded: string): string {
  const text = decoded.trim();
  try {
    const parts = new URL(text).pathname.split('/').filter(Boolean);
    return parts[parts.length - 1] || text;
  } catch {
    const parts = text.split('/').filter(Boolean);
    return parts[parts.length - 1] || text;
  }
}

// ── Helpers ───────────────────────────────────────────────────────

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload  = () => res(reader.result as string);
    reader.onerror = rej;
    reader.readAsDataURL(blob);
  });
}

function SectionCard({ title, children, delay = 0 }: { title: string; children: React.ReactNode; delay?: number }) {
  return (
    <motion.section
      className="card p-5"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
    >
      <h2 className="font-bold mb-4 pl-3" style={{ color: 'var(--navy)', fontSize: '16px', borderLeft: '3px solid var(--green)' }}>{title}</h2>
      {children}
    </motion.section>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl ${className}`} style={{ backgroundColor: 'var(--bg-surface)' }} />;
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="rounded-xl px-3 py-2 text-sm" role="alert"
      style={{ backgroundColor: 'var(--status-late-bg)', color: 'var(--status-late-text)' }}>
      {msg}
    </div>
  );
}

function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <motion.div
      className="fixed bottom-6 left-1/2 z-50 px-4 py-3 rounded-2xl shadow-lg text-sm font-semibold"
      style={{ backgroundColor: ok ? 'var(--green)' : '#E05050', color: '#fff', maxWidth: '320px' }}
      initial={{ opacity: 0, y: 24, x: '-50%' }}
      animate={{ opacity: 1, y: 0, x: '-50%' }}
      exit={{ opacity: 0, y: 24, x: '-50%' }}
    >
      {msg}
    </motion.div>
  );
}

// Render rekap AI — format sama persis dengan halaman publik
function RekapView({ rekap }: { rekap: RekapAI }) {
  const updatedAt = new Date(rekap.generated_at).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium" style={{ color: 'var(--navy)' }}>{rekap.summary}</p>
      <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--bg-surface)' }}>
        <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Pengiriman</p>
        <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{rekap.delivery.description}</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
          Ketepatan: {rekap.delivery.accuracy_pct}%
        </p>
      </div>
      <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--bg-surface)' }}>
        <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Saran Perbaikan</p>
        <ul className="flex flex-col gap-1">
          {rekap.suggestions.map((s, i) => (
            <li key={i} className="text-sm flex gap-2" style={{ color: 'var(--text-primary)' }}>
              <span style={{ color: 'var(--green)' }}>•</span>{s}
            </li>
          ))}
        </ul>
      </div>
      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
        {rekap.cached ? `Diperbarui: ${updatedAt}` : 'Baru diperbarui'}
      </p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { sppgId, sppgName, mounted } = useAuth();
  const router = useRouter();

  const [process,   setProcess]   = useState<ProcessTimeline | null>(null);
  const [menuToday, setMenuToday] = useState<MenuResponse | null>(null);
  const [qrList,    setQrList]    = useState<SchoolQR[]>([]);
  const [toast,     setToast]     = useState<{ msg: string; ok: boolean } | null>(null);

  // Load state global (proses + QR)
  const [pageLoading, setPageLoading] = useState(true);
  const [pageErr,     setPageErr]     = useState('');

  // Delivery QR state — alur: idle → scanning (pindai QR) → camera (foto bukti)
  const [deliveryStep, setDeliveryStep] = useState<'idle' | 'scanning' | 'camera'>('idle');
  const [activeQR,     setActiveQR]     = useState<SchoolQR | null>(null);
  const [deliveryErr,  setDeliveryErr]  = useState('');

  // Menu form state
  const [menuDesc,     setMenuDesc]     = useState('');
  const [menuPhoto,    setMenuPhoto]    = useState<string | null>(null);   // base64 data URL ATAU URL existing (saat edit)
  const [menuLoading,  setMenuLoading]  = useState(false);
  const [menuErr,      setMenuErr]      = useState('');
  const [menuFetching, setMenuFetching] = useState(true);                  // loading menu hari ini
  const [editing,      setEditing]      = useState(false);                 // paksa tampilkan form walau data sudah ada

  // Rekap AI state
  const [aiTab,        setAiTab]        = useState<'weekly' | 'monthly'>('weekly');
  const [weekly,       setWeekly]       = useState<RekapAI | null>(null);
  const [weeklyState,  setWeeklyState]  = useState<'loading' | 'ok' | 'error'>('loading');
  const [monthly,      setMonthly]      = useState<RekapAI | null>(null);
  const [monthlyState, setMonthlyState] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');

  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const reload = useCallback(() => {
    if (!sppgId) return;
    Promise.all([fetchProcessTimeline(sppgId), fetchMyQR()])
      .then(([proc, qr]) => {
        setProcess(proc);
        setQrList(qr);
        setPageErr('');
        setPageLoading(false);
        fetchMenuToday(sppgId)
          .then(setMenuToday)
          .catch(() => setMenuToday(null))
          .finally(() => setMenuFetching(false));
      })
      .catch((e: unknown) => {
        setPageErr(e instanceof Error ? e.message : 'Gagal memuat data dashboard.');
        setPageLoading(false);
      });
  }, [sppgId]);

  useEffect(() => { reload(); }, [reload]);

  // Rekap mingguan dimuat eager (butuh auth). State awal sudah 'loading'.
  useEffect(() => {
    if (!sppgId) return;
    fetchAIRecap(sppgId, true)
      .then((r) => { setWeekly(r); setWeeklyState('ok'); })
      .catch(() => setWeeklyState('error'));
  }, [sppgId]);

  const openMonthly = useCallback(() => {
    setAiTab('monthly');
    if (monthlyState !== 'idle' || !sppgId) return;
    setMonthlyState('loading');
    fetchAIRecapMonthly(sppgId, true)
      .then((r) => { setMonthly(r); setMonthlyState('ok'); })
      .catch(() => setMonthlyState('error'));
  }, [sppgId, monthlyState]);

  // ── Kitchen photo upload ──────────────────────────────────────
  // Lempar error agar CameraCapture menampilkan pesan + "Coba Lagi"
  // (CameraCapture tidak menutup saat upload gagal).

  const handleKitchenPhoto = useCallback(async (stage: 'persiapan' | 'masak', blob: Blob) => {
    const photo = await blobToBase64(blob);
    await uploadKitchenPhoto({ stage, photo });
    showToast(`Foto ${stage} tersimpan.`);
    reload();
  }, [reload, showToast]);

  // ── Delivery confirm ──────────────────────────────────────────

  // Mulai: buka kamera pemindai QR untuk sekolah ini (kamera foto BELUM aktif).
  const handleDeliveryStart = useCallback((qr: SchoolQR) => {
    if (!qr.delivery_token) return;
    setDeliveryErr('');
    setActiveQR(qr);
    setDeliveryStep('scanning');
  }, []);

  // Dipanggil QRScanner saat QR terdeteksi. Validasi ke backend (constraint #4):
  // QR harus valid, jenis delivery, dan milik sekolah yang sedang dikonfirmasi.
  // Lempar error → scanner menampilkan pesan + "Pindai Lagi" (tidak menutup).
  const handleQRScanned = useCallback(async (decoded: string) => {
    const token = extractToken(decoded);
    const res = await validateQR(token);
    if (!res.valid) throw new Error(res.message || 'QR tidak valid.');
    if (res.kind !== 'delivery') throw new Error('QR ini bukan QR pengiriman.');
    if (activeQR && token !== activeQR.delivery_token) {
      throw new Error(`QR yang dipindai bukan untuk ${activeQR.school_name}.`);
    }
    // Valid & cocok → baru kamera foto bukti diaktifkan.
    setDeliveryStep('camera');
  }, [activeQR]);

  const handleDeliveryPhoto = useCallback(async (blob: Blob) => {
    if (!activeQR?.delivery_token) return;
    const photo = await blobToBase64(blob);
    await confirmDelivery(activeQR.delivery_token, { photo });
    showToast(`Pengiriman ke ${activeQR.school_name} terkonfirmasi.`);
    setDeliveryStep('idle');
    setActiveQR(null);
    reload();
  }, [activeQR, reload, showToast]);

  // ── Menu capture (simpan ke state dulu) + submit ──────────────

  const handleMenuPhoto = useCallback(async (blob: Blob) => {
    const photo = await blobToBase64(blob);
    setMenuPhoto(photo);
  }, []);

  const startEditMenu = useCallback(() => {
    if (!menuToday) return;
    setMenuDesc(menuToday.description);
    setMenuPhoto(menuToday.photo_url ?? null);   // URL existing; dipakai ulang bila tak diambil ulang
    setMenuErr('');
    setEditing(true);
  }, [menuToday]);

  const cancelEditMenu = useCallback(() => {
    setEditing(false);
    setMenuDesc('');
    setMenuPhoto(null);
    setMenuErr('');
  }, []);

  const menuFormValid = menuDesc.trim().length > 0 && !!menuPhoto;

  const handleMenuSubmit = useCallback(async () => {
    setMenuErr('');
    if (!menuFormValid) { setMenuErr('Teks dan foto menu wajib diisi.'); return; }
    setMenuLoading(true);
    try {
      // Foto baru (data URL) → kirim base64; foto lama (URL https) → kirim photo_url.
      const isNewPhoto = menuPhoto!.startsWith('data:');
      await uploadMenuToday({
        description: menuDesc,
        ...(isNewPhoto ? { photo: menuPhoto } : { photo_url: menuPhoto }),
      });
      showToast('Menu hari ini tersimpan.');
      setMenuDesc('');
      setMenuPhoto(null);
      setEditing(false);
      reload();
    } catch (e: unknown) {
      // Submit gagal → tampilkan error (di-extract sbg string), JANGAN reset form.
      const msg = e instanceof Error ? e.message : typeof e === 'string' ? e : 'Gagal simpan menu.';
      setMenuErr(msg);
    } finally {
      setMenuLoading(false);
    }
  }, [menuDesc, menuPhoto, menuFormValid, reload, showToast]);

  // ── Render ────────────────────────────────────────────────────

  if (!mounted) return null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
      {/* Header band navy */}
      <header className="bg-gradient-navy">
        <div className="mx-auto px-4 py-6 lg:px-8 flex items-center justify-between" style={{ maxWidth: '560px' }}>
          <div className="min-w-0">
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold mb-1.5"
              style={{ backgroundColor: 'rgba(255,255,255,0.14)', color: 'var(--gold)' }}>
              Operator
            </span>
            <h1 className="font-bold text-white truncate" style={{ fontSize: '20px', letterSpacing: '-0.01em' }} suppressHydrationWarning>{sppgName}</h1>
          </div>
          <button onClick={() => { logout(); router.replace('/login'); }}
            className="btn-outline-light text-xs px-4 shrink-0"
            style={{ height: '38px' }}>
            Keluar
          </button>
        </div>
      </header>

      <div className="mx-auto px-4 py-6 lg:px-8 flex flex-col gap-4" style={{ maxWidth: '560px' }}>
      {pageErr && <ErrorBox msg={pageErr} />}

      {pageLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : (
        <>
          {/* Menu harian */}
          <motion.div
            className="card p-5 relative"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <h2 className="font-bold mb-4 pl-3" style={{ color: 'var(--navy)', fontSize: '16px', borderLeft: '3px solid var(--green)' }}>Menu Hari Ini</h2>

            {/* Tombol Edit kecil — hanya saat sudah ada data & tidak sedang edit */}
            {menuToday && !editing && !menuFetching && (
              <button type="button" onClick={startEditMenu}
                className="btn-outline absolute top-4 right-4 text-xs px-3 py-1.5">
                Edit
              </button>
            )}

            {menuFetching ? (
              <Skeleton className="h-44" />
            ) : (menuToday && !editing) ? (
              /* Sudah ada data → preview foto + teks */
              <div className="flex flex-col gap-3">
                {menuToday.photo_url && (
                  <div className="relative w-full h-48 rounded-xl overflow-hidden">
                    <Image src={menuToday.photo_url} alt="Foto menu hari ini" fill
                      sizes="(max-width: 560px) 100vw, 560px" className="object-cover" />
                  </div>
                )}
                <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{menuToday.description}</p>
              </div>
            ) : (
              /* Belum ada data / mode edit → form */
              <div className="flex flex-col gap-3">
                <textarea
                  value={menuDesc}
                  onChange={(e) => setMenuDesc(e.target.value)}
                  placeholder="Contoh: Nasi, ayam goreng, tumis buncis, jeruk"
                  rows={3}
                  className="w-full rounded-xl p-3 text-sm resize-none"
                  style={{ border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }}
                />

                {/* Foto wajib — preview kecil sebelum submit */}
                {menuPhoto ? (
                  <div className="flex flex-col gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={menuPhoto} alt="Pratinjau foto menu"
                      className="w-full max-h-48 object-cover rounded-xl" />
                    <CameraCapture
                      label="Ambil Ulang Foto"
                      onCapture={handleMenuPhoto}
                      onCancel={() => {}}
                    />
                  </div>
                ) : (
                  <CameraCapture
                    label="Ambil Foto Menu"
                    onCapture={handleMenuPhoto}
                    onCancel={() => {}}
                  />
                )}

                <button onClick={handleMenuSubmit} disabled={!menuFormValid || menuLoading}
                  className="btn-primary w-full py-2.5 text-sm font-medium rounded-xl"
                  style={{ opacity: (!menuFormValid || menuLoading) ? 0.5 : 1, cursor: (!menuFormValid || menuLoading) ? 'not-allowed' : 'pointer' }}>
                  {menuLoading ? 'Menyimpan…' : 'Simpan'}
                </button>

                {/* Error submit — di bawah tombol Simpan, form tidak di-reset */}
                {menuErr && <ErrorBox msg={menuErr} />}

                {editing && (
                  <button type="button" onClick={cancelEditMenu}
                    className="w-full py-2 text-sm rounded-xl"
                    style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                    Batal
                  </button>
                )}
              </div>
            )}
          </motion.div>

          {/* Proses dapur */}
          <SectionCard title="Proses Dapur" delay={0.05}>
            <div className="flex flex-col gap-4">
              {(['persiapan', 'masak'] as const).map((stage) => {
                const s        = process?.[stage];
                const done     = s?.done ?? false;
                const photoUrl = s?.photo_url ?? null;
                return (
                  <div key={stage} className="flex flex-col gap-2 pb-3"
                    style={{ borderBottom: '1px solid var(--border)' }}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm capitalize font-medium" style={{ color: 'var(--text-primary)' }}>{stage}</p>
                      <p className="text-xs" style={{ color: done ? 'var(--green-text)' : 'var(--text-tertiary)' }}>
                        {done ? 'Foto tersimpan ✓' : 'Belum ada foto'}
                      </p>
                    </div>

                    {photoUrl && (
                      <div className="relative w-full h-40 rounded-xl overflow-hidden">
                        <Image src={photoUrl} alt={`Foto ${stage}`} fill
                          sizes="(max-width: 560px) 100vw, 560px" className="object-cover" />
                      </div>
                    )}

                    <CameraCapture
                      label={photoUrl ? 'Ambil Ulang' : `Foto ${stage}`}
                      onCapture={(blob) => handleKitchenPhoto(stage, blob)}
                      onCancel={() => {}}
                    />
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* Konfirmasi pengiriman */}
          <SectionCard title="Konfirmasi Pengiriman" delay={0.1}>
            {deliveryStep === 'scanning' && activeQR ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Pindai QR pengiriman yang tertempel di <strong>{activeQR.school_name}</strong>.
                </p>
                <QRScanner
                  label="Buka Kamera Pemindai"
                  onDetected={handleQRScanned}
                  onCancel={() => { setDeliveryStep('idle'); setActiveQR(null); }}
                />
              </div>
            ) : deliveryStep === 'camera' && activeQR ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  QR valid. Foto bukti pengiriman ke <strong>{activeQR.school_name}</strong>
                </p>
                <CameraCapture
                  label="Ambil Foto Bukti"
                  onCapture={handleDeliveryPhoto}
                  onCancel={() => { setDeliveryStep('idle'); setActiveQR(null); }}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {deliveryErr && <ErrorBox msg={deliveryErr} />}
                {qrList.map((qr) => {
                  const deliv    = process?.pengiriman.find((p) => p.school_id === qr.school_id);
                  const done     = deliv?.done ?? false;
                  const photoUrl = deliv?.photo_url ?? null;
                  return (
                    <div key={qr.school_id} className="flex flex-col gap-2 py-2"
                      style={{ borderBottom: '1px solid var(--border)' }}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{qr.school_name}</p>
                          <p className="text-xs" style={{ color: done ? 'var(--green-text)' : 'var(--text-tertiary)' }}>
                            {done ? 'Terkirim ✓' : 'Belum dikonfirmasi'}
                          </p>
                        </div>
                        {!done && (
                          <button onClick={() => handleDeliveryStart(qr)}
                            className="btn-primary px-3 py-1.5 text-xs rounded-xl">
                            Scan QR
                          </button>
                        )}
                      </div>
                      {done && photoUrl && (
                        <div className="relative w-full h-48 rounded-xl overflow-hidden">
                          <Image src={photoUrl} alt={`Bukti pengiriman ${qr.school_name}`} fill
                            sizes="(max-width: 560px) 100vw, 560px" className="object-cover" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          {/* Rekap AI */}
          <SectionCard title="Rekap AI" delay={0.15}>
            <div className="flex gap-5 mb-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <button type="button" onClick={() => setAiTab('weekly')}
                className={`tab-underline pb-2.5 text-sm ${aiTab === 'weekly' ? 'active' : ''}`}>
                Mingguan
              </button>
              <button type="button" onClick={openMonthly}
                className={`tab-underline pb-2.5 text-sm ${aiTab === 'monthly' ? 'active' : ''}`}>
                Bulanan
              </button>
            </div>

            {aiTab === 'weekly' ? (
              weeklyState === 'loading' ? (
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ) : weeklyState === 'error' ? (
                <ErrorBox msg="Gagal memuat rekap mingguan. Coba muat ulang halaman." />
              ) : weekly ? (
                <RekapView rekap={weekly} />
              ) : (
                <p className="text-sm text-center py-2" style={{ color: 'var(--text-tertiary)' }}>Belum ada data.</p>
              )
            ) : (
              monthlyState === 'loading' || monthlyState === 'idle' ? (
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ) : monthlyState === 'error' ? (
                <ErrorBox msg="Gagal memuat rekap bulanan. Coba muat ulang halaman." />
              ) : monthly ? (
                <RekapView rekap={monthly} />
              ) : (
                <p className="text-sm text-center py-2" style={{ color: 'var(--text-tertiary)' }}>Belum ada data.</p>
              )
            )}
          </SectionCard>
        </>
      )}
      </div>

      <AnimatePresence>
        {toast && <Toast msg={toast.msg} ok={toast.ok} />}
      </AnimatePresence>
    </motion.div>
  );
}
