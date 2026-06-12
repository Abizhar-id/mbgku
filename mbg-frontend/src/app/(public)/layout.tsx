import Link from 'next/link';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-page)' }}>

      {/* ── Sticky public header ─────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-20"
        style={{
          backgroundColor: 'var(--navy)',
          boxShadow: '0 1px 8px rgba(7,30,73,0.18)',
        }}
      >
        <div
          className="mx-auto flex items-center justify-between px-4 lg:px-8 max-w-[520px] lg:max-w-5xl"
          style={{ height: '54px' }}
        >
          {/* Brand */}
          <Link
            href="/"
            className="flex items-center gap-2"
            style={{ textDecoration: 'none' }}
            aria-label="MBG-ku — halaman utama"
          >
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
              aria-hidden="true"
            >
              <svg className="w-4 h-4" fill="none" stroke="#92D05D" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z"
                />
              </svg>
            </div>
            <span className="font-semibold" style={{ fontSize: '15px', color: '#FFFFFF', letterSpacing: '-0.01em' }}>
              MBG-ku
            </span>
          </Link>

          {/* Login CTA */}
          <Link
            href="/login"
            className="btn-primary flex items-center gap-1.5 px-4"
            style={{ fontSize: '13px', height: '36px', textDecoration: 'none' }}
            aria-label="Login sebagai operator SPPG"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
            </svg>
            Login
          </Link>
        </div>
      </header>

      {children}
    </div>
  );
}
