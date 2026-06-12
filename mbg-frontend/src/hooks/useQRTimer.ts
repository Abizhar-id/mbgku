'use client';
import { useEffect, useState } from 'react';

const OPEN_HOUR  = 9;
const CLOSE_HOUR = 12;

function getWindowStatus(): { open: boolean; label: string } {
  const now = new Date();
  const h   = now.getHours();
  const m   = now.getMinutes();
  const s   = now.getSeconds();

  if (h >= OPEN_HOUR && h < CLOSE_HOUR) {
    // Hitung sisa waktu sampai tutup
    const closeMs = (CLOSE_HOUR * 3600 - h * 3600 - m * 60 - s) * 1000;
    const mins    = Math.floor(closeMs / 60000);
    const secs    = Math.floor((closeMs % 60000) / 1000);
    return { open: true, label: `Tutup dalam ${mins}m ${secs}s` };
  }

  // Hitung waktu sampai buka
  let openMs: number;
  if (h < OPEN_HOUR) {
    openMs = (OPEN_HOUR * 3600 - h * 3600 - m * 60 - s) * 1000;
  } else {
    // Sudah lewat jam 12, hitung ke hari berikutnya
    openMs = ((24 - h + OPEN_HOUR) * 3600 - m * 60 - s) * 1000;
  }
  const hrs  = Math.floor(openMs / 3600000);
  const mins = Math.floor((openMs % 3600000) / 60000);
  return { open: false, label: `Buka dalam ${hrs}j ${mins}m` };
}

export function useQRTimer() {
  const [status, setStatus] = useState(getWindowStatus);

  useEffect(() => {
    const id = setInterval(() => setStatus(getWindowStatus()), 1000);
    return () => clearInterval(id);
  }, []);

  return status;
}