export interface SPPG {
  id: number;
  name: string;
  address: string | null;
  avg_rating: number;
  total_feedback: number;
  delivery_rate: number;
  rank: number;
}

export interface School {
  id: number;
  sppg_id: number;
  name: string;
}

export interface SPPGProfile extends SPPG {
  recent_deliveries: DeliverySummary[];
  today_menu: MenuSummary | null;
}

export interface DeliverySummary {
  school_id: number;
  school_name: string;
  delivery_date: string;
  status: 'pending' | 'delivered' | 'late';
  sent_at: string | null;
  arrived_at: string | null;
  photo_url: string | null;
}

export interface MenuSummary {
  menu_date: string;
  description: string;
  photo_url: string | null;
}

export interface ProcessTimeline {
  sppg_id: number;
  date: string;
  persiapan: StageStatus;
  masak: StageStatus;
  pengiriman: SchoolDelivery[];
}

export interface StageStatus {
  stage: string;
  done: boolean;
  photo_url: string | null;
}

export interface SchoolDelivery {
  school_id: number;
  school_name: string;
  done: boolean;
  photo_url: string | null;
}