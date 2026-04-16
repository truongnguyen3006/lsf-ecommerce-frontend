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

