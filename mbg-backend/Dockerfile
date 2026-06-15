FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# Railway nyetel $PORT otomatis; fallback 8000 buat lokal.
# --proxy-headers + --forwarded-allow-ips='*' → uvicorn membaca X-Forwarded-For
# dari proxy Railway, jadi rate-limit (slowapi) memakai IP asli klien, bukan IP proxy.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
