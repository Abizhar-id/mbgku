'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  fetchAdminSchools,
  generateDeliveryQR,
  generateFeedbackQR,
  getDeliveryQRImage,
  getFeedbackQRImage,
} from '@/lib/api/admin';
import { logout } from '@/lib/api/auth';
import type { AdminSchool } from '@/types/api';

type Kind = 'delivery' | 'feedback';

const KIND_LABEL: Record<Kind, string> = {
  delivery: 'QR Pengiriman (untuk SPPG)',
  feedback: 'QR Feedback (untuk Siswa)',
};

const keyOf = (schoolId: number, kind: Kind) => `${schoolId}-${kind}`;

// ── Small UI helpers ───────────────────────────────────────────────

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

// Chevron yang berputar saat accordion toggle (▼ saat expand, ▶ saat collapse)
function Chevron({ expanded }: { expanded: boolean }) {
  return (
    <motion.svg
      width="18" height="18" viewBox="0 0 24 24" fill="none"
      animate={{ rotate: expanded ? 0 : -90 }}
      transition={{ duration: 0.2 }}
      style={{ color: '#ffffff', flexShrink: 0 }}
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </motion.svg>
  );
}

function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-2xl shadow-lg text-sm font-semibold"
      style={{ backgroundColor: ok ? 'var(--green)' : '#E05050', color: '#fff', maxWidth: '320px' }}>
      {msg}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter();

  const [schools,     setSchools]     = useState<AdminSchool[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageErr,     setPageErr]     = useState('');
  const [toast,       setToast]       = useState<{ msg: string; ok: boolean } | null>(null);

  // Loading & error per-tombol (key = `${schoolId}-${kind}`)
  const [genLoading, setGenLoading] = useState<Record<string, boolean>>({});
  const [cardErr,    setCardErr]    = useState<Record<string, string>>({});

  // Modal "Lihat QR"
  const [modal,      setModal]      = useState<{ schoolName: string; kind: Kind } | null>(null);
  const [modalState, setModalState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [modalImg,   setModalImg]   = useState<string | null>(null);
  const [modalErr,   setModalErr]   = useState('');

  // Konfirmasi "Generate Ulang"
  const [confirm, setConfirm] = useState<{ schoolId: number; schoolName: string; kind: Kind } | null>(null);

  // Pencarian SPPG / sekolah (real-time, tidak case-sensitive)
  const [search, setSearch] = useState('');

  // Accordion: default semua SPPG ter-expand. Simpan hanya yang DI-collapse.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleSppg = useCallback((name: string) => {
    setCollapsed((s) => ({ ...s, [name]: !s[name] }));
  }, []);

  // Group sekolah per SPPG (urutan stabil sesuai kemunculan pertama di data).
  const grouped = useMemo(
    () =>
      schools.reduce((acc, s) => {
        (acc[s.sppg_name] ??= []).push(s);
        return acc;
      }, {} as Record<string, AdminSchool[]>),
    [schools],
  );

  // Filter accordion sesuai query. Cocok nama SPPG → tampilkan semua sekolahnya;
  // cocok nama sekolah → tampilkan SPPG penaung dengan hanya sekolah yang cocok.
  const filteredGroups = useMemo(() => {
    if (!search.trim()) return grouped;
    const q = search.toLowerCase();
    const result: Record<string, AdminSchool[]> = {};
    Object.entries(grouped).forEach(([sppgName, list]) => {
      const sppgMatch = sppgName.toLowerCase().includes(q);
      const matchedSchools = list.filter((s) => s.school_name.toLowerCase().includes(q));
      if (sppgMatch) {
        result[sppgName] = list;             // tampilkan semua sekolah
      } else if (matchedSchools.length > 0) {
        result[sppgName] = matchedSchools;   // hanya sekolah yang cocok
      }
    });
    return result;
  }, [grouped, search]);

  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const loadSchools = useCallback(() => {
    setPageLoading(true);
    fetchAdminSchools()
      .then((data) => { setSchools(data); setPageErr(''); })
      .catch((e: unknown) => setPageErr(e instanceof Error ? e.message : 'Gagal memuat data sekolah.'))
      .finally(() => setPageLoading(false));
  }, []);

  useEffect(() => { loadSchools(); }, [loadSchools]);

  const handleLogout = useCallback(() => {
    logout();
    router.replace('/login');
  }, [router]);

  // ── Lihat QR ─────────────────────────────────────────────────────

  const closeModal = useCallback(() => {
    setModalImg((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    setModal(null);
    setModalErr('');
  }, []);

  const openQR = useCallback(async (school: AdminSchool, kind: Kind) => {
    setModal({ schoolName: school.school_name, kind });
    setModalState('loading');
    setModalImg((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    setModalErr('');
    try {
      const url = kind === 'delivery'
        ? await getDeliveryQRImage(school.school_id)
        : await getFeedbackQRImage(school.school_id);
      setModalImg(url);
      setModalState('ok');
    } catch (e: unknown) {
      setModalErr(e instanceof Error ? e.message : 'Gagal memuat QR.');
      setModalState('error');
    }
  }, []);

  const downloadQR = useCallback(() => {
    if (!modalImg || !modal) return;
    const a = document.createElement('a');
    a.href = modalImg;
    a.download = `qr-${modal.kind}-${modal.schoolName.replace(/\s+/g, '-')}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [modalImg, modal]);

  // ── Generate Ulang ───────────────────────────────────────────────

  const runGenerate = useCallback(async () => {
    if (!confirm) return;
    const { schoolId, schoolName, kind } = confirm;
    const k = keyOf(schoolId, kind);
    setConfirm(null);
    setGenLoading((s) => ({ ...s, [k]: true }));
    setCardErr((s) => ({ ...s, [k]: '' }));
    try {
      if (kind === 'delivery') await generateDeliveryQR(schoolId);
      else await generateFeedbackQR(schoolId);

      // Token berubah → QR lama (yang mungkin sedang tampil) tidak relevan lagi.
      if (modal && modal.schoolName === schoolName && modal.kind === kind) closeModal();

      showToast(`${kind === 'delivery' ? 'QR Pengiriman' : 'QR Feedback'} ${schoolName} berhasil diperbarui.`);
      loadSchools();
    } catch (e: unknown) {
      setCardErr((s) => ({ ...s, [k]: e instanceof Error ? e.message : 'Gagal generate ulang QR.' }));
    } finally {
      setGenLoading((s) => ({ ...s, [k]: false }));
    }
  }, [confirm, modal, closeModal, showToast, loadSchools]);

  // ── Render ───────────────────────────────────────────────────────

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
      {/* Header band navy */}
      <header className="bg-gradient-navy">
        <div className="mx-auto px-4 py-6 lg:px-8 flex items-center justify-between" style={{ maxWidth: '560px' }}>
          <div>
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold mb-1.5"
              style={{ backgroundColor: 'rgba(255,255,255,0.14)', color: 'var(--gold)' }}>
              Kelola QR Sekolah
            </span>
            <h1 className="font-bold text-white" style={{ fontSize: '20px', letterSpacing: '-0.01em' }}>Admin MBGku</h1>
          </div>
          <button onClick={handleLogout}
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
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
        </div>
      ) : schools.length === 0 && !pageErr ? (
        <p className="text-sm text-center py-6" style={{ color: 'var(--text-tertiary)' }}>Belum ada sekolah.</p>
      ) : (
        <>
          {/* Search bar — style identik SearchBar.tsx (leaderboard) */}
          <div className="relative w-full">
            <svg className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--text-tertiary)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari SPPG dan Sekolah..."
              className="field pl-11 pr-3 text-sm"
              style={{ height: '48px' }}
              aria-label="Cari SPPG dan Sekolah"
            />
          </div>

          {Object.keys(filteredGroups).length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: 'var(--text-tertiary)' }}>
              Tidak ada SPPG atau sekolah yang ditemukan.
            </p>
          ) : (
            Object.entries(filteredGroups).map(([sppgName, list]) => {
              // Query aktif → paksa accordion ter-expand; preferensi collapse manual
              // user tidak diubah (dipulihkan saat search dikosongkan).
              const isExpanded = search.trim() ? true : !collapsed[sppgName];
              return (
            <motion.div
              key={sppgName}
              className="card"
              style={{ overflow: 'hidden' }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* Header SPPG — klik untuk expand/collapse */}
              <button
                type="button"
                onClick={() => toggleSppg(sppgName)}
                aria-expanded={isExpanded}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
                style={{ backgroundColor: 'var(--navy)' }}
              >
                <h2 className="font-semibold" style={{ color: '#ffffff', fontSize: '15px' }}>{sppgName}</h2>
                <Chevron expanded={isExpanded} />
              </button>

              {/* Daftar sekolah (accordion) */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    key="content"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    style={{ overflow: 'hidden' }}
                  >
                    {list.map((school) => (
                      <div key={school.school_id} className="py-3 px-4 transition-colors hover:bg-[var(--bg-surface)]" style={{ borderTop: '1px solid var(--border)' }}>
                        <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>{school.school_name}</p>

                        <div className="flex flex-col gap-2">
                          {(['delivery', 'feedback'] as const).map((kind) => {
                            const k = keyOf(school.school_id, kind);
                            return (
                              <div key={kind} className="flex flex-col gap-1">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-sm flex-1 min-w-0" style={{ color: 'var(--text-secondary)' }}>{KIND_LABEL[kind]}</p>
                                  <div className="flex gap-2 shrink-0">
                                    <button onClick={() => openQR(school, kind)}
                                      className="btn-primary px-3 py-1.5 text-xs rounded-xl">
                                      Lihat QR
                                    </button>
                                    <button onClick={() => setConfirm({ schoolId: school.school_id, schoolName: school.school_name, kind })}
                                      disabled={genLoading[k]}
                                      className="btn-outline px-3 py-1.5 text-xs"
                                      style={{ opacity: genLoading[k] ? 0.6 : 1 }}>
                                      {genLoading[k] ? 'Memproses…' : 'Generate Ulang'}
                                    </button>
                                  </div>
                                </div>
                                {cardErr[k] && <ErrorBox msg={cardErr[k]} />}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
            })
          )}
        </>
      )}
      </div>

      {/* Modal Lihat QR */}
      <AnimatePresence>
        {modal && (
          <motion.div
            className="fixed inset-0 z-40 flex items-center justify-center px-4"
            style={{ backgroundColor: 'rgba(7,30,73,0.45)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={closeModal}
          >
            <motion.div
              className="w-full p-6 flex flex-col gap-4"
              style={{ maxWidth: '360px', backgroundColor: 'var(--bg-card)', borderRadius: '24px', boxShadow: '0 24px 60px rgba(7,30,73,0.35)' }}
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <h3 className="font-bold" style={{ color: 'var(--navy)', fontSize: '16px' }}>
                  {modal.kind === 'delivery' ? 'QR Pengiriman' : 'QR Feedback'}
                </h3>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{modal.schoolName}</p>
              </div>

              {modalState === 'loading' ? (
                <Skeleton className="w-full" />
              ) : modalState === 'error' ? (
                <ErrorBox msg={modalErr} />
              ) : modalImg ? (
                <div className="flex justify-center rounded-xl p-3" style={{ backgroundColor: '#fff', border: '1px solid var(--border)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={modalImg} alt={`QR ${modal.kind} ${modal.schoolName}`} className="w-56 h-56" />
                </div>
              ) : null}

              <div className="flex gap-2">
                {modalState === 'ok' && (
                  <button onClick={downloadQR} className="btn-primary px-3 py-2 text-xs rounded-xl flex-1">
                    Download QR
                  </button>
                )}
                <button onClick={closeModal}
                  className="px-3 py-2 text-xs rounded-xl flex-1"
                  style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                  Tutup
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Konfirmasi Generate Ulang */}
      <AnimatePresence>
        {confirm && (
          <motion.div
            className="fixed inset-0 z-40 flex items-center justify-center px-4"
            style={{ backgroundColor: 'rgba(7,30,73,0.45)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setConfirm(null)}
          >
            <motion.div
              className="w-full p-6 flex flex-col gap-4"
              style={{ maxWidth: '360px', backgroundColor: 'var(--bg-card)', borderRadius: '24px', boxShadow: '0 24px 60px rgba(7,30,73,0.35)' }}
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-bold" style={{ color: 'var(--navy)', fontSize: '16px' }}>Generate Ulang QR</h3>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                QR lama akan langsung invalid. Lanjutkan?
              </p>
              <div className="flex gap-2">
                <button onClick={runGenerate} className="btn-primary px-3 py-2 text-xs rounded-xl flex-1">
                  Lanjutkan
                </button>
                <button onClick={() => setConfirm(null)}
                  className="px-3 py-2 text-xs rounded-xl flex-1"
                  style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                  Batal
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {toast && <Toast msg={toast.msg} ok={toast.ok} />}
    </motion.div>
  );
}
