from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


class SPPG(BaseModel):
    id: int
    name: str
    address: Optional[str] = None
    created_at: Optional[datetime] = None


class School(BaseModel):
    id: int
    sppg_id: int
    name: str


class Operator(BaseModel):
    id: int
    sppg_id: int
    username: str
    # password sengaja TIDAK diekspos di model response


class Delivery(BaseModel):
    id: int
    sppg_id: int
    school_id: int
    delivery_date: date
    sent_at: Optional[datetime] = None
    arrived_at: Optional[datetime] = None
    status: str = "pending"  # pending | delivered | late
    photo_url: Optional[str] = None


class Menu(BaseModel):
    id: int
    sppg_id: int
    menu_date: date
    description: str
    photo_url: Optional[str] = None


class Feedback(BaseModel):
    id: int
    sppg_id: int
    school_id: int
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = None
    photo_url: Optional[str] = None
    created_at: Optional[datetime] = None


class QRToken(BaseModel):
    id: int
    token: str
    kind: str  # feedback | delivery
    sppg_id: int
    school_id: Optional[int] = None
    expires_at: Optional[datetime] = None
    used: bool = False
