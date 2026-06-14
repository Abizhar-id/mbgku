"""
Rate limiting terpusat (slowapi).

Satu instance `Limiter` dipakai bersama oleh main.py (registrasi handler) dan
router yang butuh proteksi (auth, admin, feedback). Key default = alamat IP klien.

Catatan produksi: di belakang reverse proxy (Railway/Vercel/Cloudflare), pastikan
proxy meneruskan `X-Forwarded-For` agar IP klien benar — slowapi `get_remote_address`
membaca `request.client.host`. Untuk akurasi penuh di balik proxy, set ProxyHeaders
di uvicorn (`--proxy-headers`) atau ganti key_func sesuai kebutuhan.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
