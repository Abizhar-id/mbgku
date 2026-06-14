'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -64, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        // Atas (belum scroll): semi transparan agar video hero tembus.
        // Scroll >80px: solid + blur + shadow tipis.
        backgroundColor: scrolled ? 'rgba(7,30,73,0.95)' : 'rgba(7,30,73,0.35)',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(12px)' : 'none',
        boxShadow: scrolled ? '0 2px 16px rgba(7,30,73,0.25)' : 'none',
        transition: 'all 0.4s ease-in-out',
      }}
    >
      <div className="mx-auto flex items-center justify-between px-4 lg:px-8 max-w-[520px] lg:max-w-6xl"
        style={{ height: '60px' }}>
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5" style={{ textDecoration: 'none' }}
          aria-label="MBGku, halaman utama">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: 'rgba(255,255,255,0.14)', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))' }} aria-hidden="true">
            <svg className="w-[18px] h-[18px]" fill="none" stroke="var(--gold)" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z" />
            </svg>
          </div>
          <span className="font-bold" style={{ fontSize: '17px', color: '#FFFFFF', letterSpacing: '-0.01em', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
            MBGku
          </span>
        </Link>

        {/* Login CTA: translucent agar terbaca di atas video, jelas di kedua kondisi navbar */}
        <Link href="/login" className="btn-outline-light flex items-center gap-1.5 px-4 py-2"
          style={{
            fontSize: '13px',
            textDecoration: 'none',
            color: '#FFFFFF',
            border: '1px solid rgba(255,255,255,0.7)',
            backgroundColor: 'rgba(255,255,255,0.1)',
            textShadow: '0 1px 3px rgba(0,0,0,0.5)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.22)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; }}
          aria-label="Login sebagai operator SPPG">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
          </svg>
          Login
        </Link>
      </div>
    </motion.header>
  );
}
