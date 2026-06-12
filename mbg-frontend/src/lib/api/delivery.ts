import type { DeliveryConfirm, DeliveryConfirmResponse } from '@/types/api';
import { apiFetch, authHeader } from './base';

export const confirmDelivery = (
  token: string,
  body: DeliveryConfirm,
): Promise<DeliveryConfirmResponse> =>
  apiFetch(`/delivery/confirm/${token}`, {
    method: 'POST',
    headers: authHeader(),
    body: JSON.stringify(body),
  });