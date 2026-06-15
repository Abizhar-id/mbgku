import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Izinkan akses dev server dari HP di jaringan lokal (LAN) saat testing.
  // Tanpa ini, Next.js 16 memblokir request cross-origin ke /_next/* (HMR dll).
  allowedDevOrigins: ['192.168.20.246'],
  images: {
    // Foto disimpan di Supabase Storage (bucket publik). Izinkan next/image
    // mengoptimasi gambar dari host Supabase mana pun.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;
