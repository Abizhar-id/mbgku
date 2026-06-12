// Auth
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  role: 'sppg' | 'admin';
  sppg_id?: number | null;
  sppg_name?: string | null;
}

// Menu
export interface MenuResponse {
  id: number;
  sppg_id: number;
  menu_date: string;
  description: string;
  photo_url: string | null;
}

export interface MenuUpload {
  description: string;
  photo?: string | null;       // base64 → di-upload server-side
  photo_url?: string | null;   // atau URL foto yang sudah ter-upload (mis. saat edit)
}

// Process (kitchen)
export interface KitchenUpload {
  stage: 'persiapan' | 'masak';
  photo: string;            // base64
}

// Delivery
export interface DeliveryConfirm {
  photo?: string;           // base64 → di-upload server-side
  photo_url?: string;       // atau URL foto yang sudah ter-upload
}

export interface DeliveryConfirmResponse {
  delivery_id: number;
  school_id: number;
  school_name: string;
  photo_url: string;
  message: string;
}

// QR
export interface SchoolQR {
  school_id: number;
  school_name: string;
  delivery_token: string | null;
  delivery_url: string | null;
  feedback_token: string | null;
  feedback_url: string | null;
}

export interface ValidateQRResponse {
  valid: boolean;
  kind: string;
  sppg_id: number;
  school_id: number | null;
  school_name: string | null;
  message: string;
}

// Admin
export interface AdminLoginResponse {
  access_token: string;
  token_type: string;
  username: string;
}

export interface AdminSchool {
  school_id: number;
  school_name: string;
  sppg_id: number;
  sppg_name: string;
  delivery_token: string | null;
  feedback_token: string | null;
}

export interface GenerateQRResponse {
  school_id: number;
  kind: 'delivery' | 'feedback';
  token: string;
  message: string;
}
