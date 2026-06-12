export interface DeliveryRecap {
  description: string;
  accuracy_pct: number;
}

export interface RekapAI {
  summary: string;
  delivery: DeliveryRecap;
  suggestions: string[];
  cached: boolean;
  generated_at: string;   // ISO timestamp
}
