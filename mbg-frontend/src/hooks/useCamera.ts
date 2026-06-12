'use client';
// Catatan: logika kamera sudah ditangani penuh di components/shared/CameraCapture.tsx.
// Hook ini disediakan sebagai placeholder bila perlu dipakai terpisah nanti.
import { useState } from 'react';

export function useCamera() {
  const [active, setActive] = useState(false);
  return { active, setActive };
}
