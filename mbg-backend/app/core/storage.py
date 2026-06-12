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
ALLOWED_FORMATS = ("jpg", "jpeg", "png", "webp")


def _decode(data: str) -> tuple[bytes, str, str]:
    """Decode base64 / data URL → (bytes, ext, content_type). Validasi format & ukuran."""
    s = data.strip()
    ext, content_type = "jpg", "image/jpeg"

    if s.startswith("data:"):
        header, b64 = s.split(",", 1)
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

    try:
        raw = base64.b64decode(b64)
    except Exception:
        raise HTTPException(status_code=400, detail="Foto tidak valid (base64 gagal di-decode).")

    # Validasi ukuran
    if len(raw) > MAX_SIZE_BYTES:
        size_mb = len(raw) / 1024 / 1024
        raise HTTPException(
            status_code=400,
            detail=f"Ukuran foto terlalu besar ({size_mb:.1f} MB). Maksimal 2 MB.",
        )

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