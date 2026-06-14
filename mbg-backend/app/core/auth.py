"""
Auth:
  POST /auth/login  → login SPPG operator, return JWT token

Guard:
  get_current_operator(token) → dependency buat endpoint private
"""
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from supabase import Client

from app.core.config import settings
from app.core.database import get_supabase
from app.core.ratelimit import limiter

router = APIRouter(prefix="/auth", tags=["auth"])
bearer_scheme = HTTPBearer()


# ── Schemas ────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str                       # "sppg" atau "admin"
    sppg_id: int | None = None
    sppg_name: str | None = None


class CurrentOperator(BaseModel):
    operator_id: int
    sppg_id: int


class CurrentAdmin(BaseModel):
    username: str


# ── JWT helpers ────────────────────────────────────────────────────

def _create_token(operator_id: int, sppg_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.JWT_EXPIRE_HOURS)
    payload = {
        "sub": str(operator_id),
        "sppg_id": sppg_id,
        "exp": expire,
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def _verify_password(plain: str, hashed: str) -> bool:
    """Verifikasi bcrypt dengan aman: nilai non-hash (mis. plaintext lama) → False,
    bukan 500. Kolom DB tetap bernama `password` (isinya hash bcrypt)."""
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except (ValueError, TypeError):
        return False


def _decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired, silakan login ulang.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token tidak valid.")


def create_admin_token(username: str) -> str:
    """JWT untuk admin platform. Payload: { role: "admin", sub: username }."""
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.JWT_EXPIRE_HOURS)
    payload = {"sub": username, "role": "admin", "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def verify_admin_token(token: str) -> dict:
    """Decode JWT & pastikan ini token admin (role == 'admin'). Return payload."""
    payload = _decode_token(token)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Akses khusus admin.")
    return payload


# ── Auth guard (dependency) ────────────────────────────────────────

def get_current_operator(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> CurrentOperator:
    """
    Dependency buat endpoint private. Contoh pemakaian:
        @router.post("/menu/today")
        def upload_menu(op: CurrentOperator = Depends(get_current_operator), ...):
            # op.sppg_id = SPPG yang sedang login
    """
    payload = _decode_token(credentials.credentials)
    return CurrentOperator(
        operator_id=int(payload["sub"]),
        sppg_id=payload["sppg_id"],
    )


def get_current_admin(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> CurrentAdmin:
    """Dependency buat endpoint admin. Tolak token non-admin (operator SPPG)."""
    payload = verify_admin_token(credentials.credentials)
    return CurrentAdmin(username=payload["sub"])


# ── Endpoint ───────────────────────────────────────────────────────

@router.post("/login", response_model=LoginResponse)
@limiter.limit("5/minute")
def login(request: Request, body: LoginRequest, db: Client = Depends(get_supabase)):
    """
    Login terpadu untuk semua role. Role dideteksi otomatis dari kredensial:
      1. Cari di tabel operator → role "sppg" (password bcrypt).
      2. Kalau tidak ada, cari di tabel admin → role "admin" (bcrypt).
      3. Kalau tidak ada di keduanya → 401.
    """

    # 1. Operator SPPG — kolom `password` berisi hash bcrypt (tanpa migrasi kolom)
    ops = (
        db.table("operator")
        .select("id, sppg_id, password")
        .eq("username", body.username)
        .execute()
        .data
    )
    if ops:
        op = ops[0]
        if not _verify_password(body.password, op["password"]):
            raise HTTPException(status_code=401, detail="Username atau password salah.")

        sppg = db.table("sppg").select("name").eq("id", op["sppg_id"]).execute().data
        sppg_name = sppg[0]["name"] if sppg else ""
        token = _create_token(operator_id=op["id"], sppg_id=op["sppg_id"])

        return LoginResponse(
            access_token=token,
            role="sppg",
            sppg_id=op["sppg_id"],
            sppg_name=sppg_name,
        )

    # 2. Admin platform (password bcrypt)
    admins = (
        db.table("admin")
        .select("username, password_hash")
        .eq("username", body.username)
        .execute()
        .data
    )
    if admins:
        admin = admins[0]
        if not _verify_password(body.password, admin["password_hash"]):
            raise HTTPException(status_code=401, detail="Username atau password salah.")

        return LoginResponse(
            access_token=create_admin_token(admin["username"]),
            role="admin",
        )

    # 3. Tidak ketemu di mana pun
    raise HTTPException(status_code=401, detail="Username atau password salah.")