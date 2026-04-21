import axiosClient from '@/lib/axiosClient';

export interface InventoryResponse {
  skuCode: string;
  quantity: number;
}

export const inventoryApi = {
  getStock: (skuCode: string) =>
    axiosClient.get<InventoryResponse, InventoryResponse>(`/api/inventory/${skuCode}`),
  
  getAvailability: (skuCode: string) =>
  axiosClient.get(
    `/api/inventory/${skuCode}/availability`,
  ) as Promise<InventoryAvailabilityResponse>,

  getOrderReservation: (orderNumber: string) =>
    axiosClient.get(
      `/api/inventory/reservations/order/${orderNumber}`,
    ) as Promise<OrderReservationSummaryResponse>,
};

export interface InventoryAvailabilityResponse {
  skuCode: string;
  physicalStock: number;
  quotaUsed: number;
  reservedCount: number;
  confirmedCount: number;
  availableStock: number;
  quotaKey: string;
  refreshedAtEpochMs: number;
}

export interface OrderReservationItemResponse {
  orderNumber: string;
  skuCode: string;
  quantity: number;
  state: string;
  reservedAtMs: number;
  expiresAtMs: number;
  confirmedAtMs?: number | null;
  releasedAtMs?: number | null;
  remainingMs: number;
  reason?: string;
  quotaKey?: string;
  requestId?: string;
}

export interface OrderReservationSummaryResponse {
  orderNumber: string;
  state: string;
  reservedAtMs: number;
  expiresAtMs: number;
  remainingMs: number;
  countdownActive: boolean;
  items: OrderReservationItemResponse[];
}

export const reservationStateTerminal = new Set(['CONFIRMED', 'RELEASED', 'EXPIRED', 'NOT_FOUND']);
