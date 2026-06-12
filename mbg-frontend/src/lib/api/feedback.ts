import type { FeedbackForm, FeedbackSubmit, FeedbackResponse, PublicFeedback } from '@/types/feedback';
import { apiFetch } from './base';

export const fetchFeedbackForm = (token: string): Promise<FeedbackForm> =>
  apiFetch(`/feedback/${token}`);

export const fetchPublicFeedback = (sppgId: number): Promise<PublicFeedback[]> =>
  apiFetch(`/feedback/public/${sppgId}`);

export const submitFeedback = (
  token: string,
  body: FeedbackSubmit,
): Promise<FeedbackResponse> =>
  apiFetch(`/feedback/${token}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });