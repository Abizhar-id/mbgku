import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
