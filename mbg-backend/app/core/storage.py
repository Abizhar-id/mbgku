"""
Helper upload foto ke Supabase Storage.

Kamera HP (frontend) menghasilkan gambar base64 / data URL.
Fungsi ini:
  1. Validasi format (jpg/jpeg/png/webp)
  2. Validasi ukuran (maks 2 MB)
  3. Upload ke bucket 'photos'
  4. Kembalikan public URL

PRASYARAT: bikin bucket 'photos' (public) di Supabase Storage.
"""
import base64
import uuid

from fastapi import HTTPException

from app.core.database import supabase

BUCKET = "photos"
MAX_SIZE_BYTES = 2 * 1024 * 1024  # 2 MB
# Base64 ±33% lebih besar dari biner → batasi panjang string SEBELUM decode
# agar payload raksasa ditolak tanpa membebani memori untuk men-decode-nya.
MAX_B64_CHARS = int(MAX_SIZE_BYTES * 4 / 3) + 1024  # ~2.8 MB + sedikit margin
ALLOWED_FORMATS = ("jpg", "jpeg", "png", "webp")


def _sniff_image(raw: bytes) -> bool:
    """Cek magic bytes: file benar-benar JPEG/PNG/WebP (bukan sekadar label)."""
    if raw[:3] == b"\xFF\xD8\xFF":                       # JPEG
        return True
    if raw[:8] == b"\x89PNG\r\n\x1a\n":                  # PNG
        return True
    if raw[:4] == b"RIFF" and raw[8:12] == b"WEBP":      # WebP (RIFF....WEBP)
        return True
    return False


def _decode(data: str) -> tuple[bytes, str, str]:
    """Decode base64 / data URL → (bytes, ext, content_type). Validasi berlapis."""
    s = data.strip()
    ext, content_type = "jpg", "image/jpeg"

    if s.startswith("data:"):
        header, b64 = s.split(",", 1)
        # Hanya terima data URL gambar.
        if not header.startswith("data:image/"):
            raise HTTPException(status_code=400, detail="File bukan gambar valid.")
        if "png" in header:
            ext, content_type = "png", "image/png"
        elif "webp" in header:
            ext, content_type = "webp", "image/webp"
        elif "jpeg" in header or "jpg" in header:
            ext, content_type = "jpg", "image/jpeg"
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Format foto tidak didukung. Gunakan: {', '.join(ALLOWED_FORMATS).upper()}.",
            )
    else:
        b64 = s

    # 1. Tolak payload kebesaran SEBELUM decode (hemat memori).
    if len(b64) > MAX_B64_CHARS:
        raise HTTPException(status_code=400, detail="Ukuran foto terlalu besar. Maksimal 2 MB.")

    try:
        raw = base64.b64decode(b64)
    except Exception:
        raise HTTPException(status_code=400, detail="Foto tidak valid (base64 gagal di-decode).")

    # 2. Validasi ukuran biner (pertahankan limit 2 MB yang sudah ada).
    if len(raw) > MAX_SIZE_BYTES:
        size_mb = len(raw) / 1024 / 1024
        raise HTTPException(
            status_code=400,
            detail=f"Ukuran foto terlalu besar ({size_mb:.1f} MB). Maksimal 2 MB.",
        )

    # 3. Validasi magic bytes — pastikan isi benar-benar gambar (anti spoof MIME).
    if not _sniff_image(raw):
        raise HTTPException(status_code=400, detail="File bukan gambar valid.")

    return raw, ext, content_type


def upload_photo(data: str, folder: str) -> str:
    """Upload foto, return public URL. `folder` mis. 'kitchen/1' atau 'delivery/2'."""
    raw, ext, content_type = _decode(data)
    path = f"{folder}/{uuid.uuid4().hex}.{ext}"

    try:
        supabase.storage.from_(BUCKET).upload(
            path, raw, {"content-type": content_type, "upsert": "true"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal upload foto ke Storage: {e}")

    return supabase.storage.from_(BUCKET).get_public_url(path)