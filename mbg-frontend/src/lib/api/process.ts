import type { KitchenUpload } from '@/types/api';
import { apiFetch, authHeader } from './base';

export const uploadKitchenPhoto = (body: KitchenUpload): Promise<{ stage: string; photo_url: string; message: string }> =>
  apiFetch('/process/kitchen', {
    method: 'POST',
    headers: authHeader(),
    body: JSON.stringify(body),
  });