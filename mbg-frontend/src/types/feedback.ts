export interface FeedbackForm {
  sppg_id: number;
  school_id: number;
  school_name: string;
  open: boolean;
  message: string;
}

export interface FeedbackSubmit {
  rating: number;       // 1-5
  comment?: string;
}

export interface FeedbackResponse {
  message: string;
}

export interface PublicFeedback {
  rating: number;
  comment: string | null;
  school_name: string;   // sudah tersensor dari backend
  created_at: string;
}