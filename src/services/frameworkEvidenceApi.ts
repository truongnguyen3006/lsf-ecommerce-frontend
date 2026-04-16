import axiosClient from '@/lib/axiosClient';
import { productApi } from '@/services/productApi';
import type { ProductVariant } from '@/types';

export interface FrameworkSkuOption {
  skuCode: string;
  label: string;
  productName?: string;
  color?: string;
  size?: string;
}

export interface OutboxRecentRow {
  id: number;
  topic: string;
  msgKey?: string;
  eventId: string;
  eventType: string;
  status: string;
  retryCount: number;
  createdAt?: string;
  sentAt?: string;
  nextAttemptAt?: string;
  leaseUntil?: string;
  leaseOwner?: string;
  lastError?: string;
}

export interface OutboxRecentFilters {
  msgKey?: string;
  eventType?: string;
  topic?: string;
}

const FALLBACK_OUTBOX_ROWS: OutboxRecentRow[] = [
  {
    id: 1,
    topic: 'order-status-envelope-topic',
    msgKey: 'ORD-DEMO-1001',
    eventId: 'demo-order-status-1001',
    eventType: 'ecommerce.order.status.v1',
    status: 'SENT',
    retryCount: 0,
    createdAt: new Date().toISOString(),
    sentAt: new Date().toISOString(),
    leaseOwner: 'order-service',
  },
  {
    id: 2,
    topic: 'inventory-reservation-confirm-envelope-topic',
    msgKey: 'ORD-DEMO-1001',
    eventId: 'demo-confirm-1001',
    eventType: 'ConfirmReservationCommand',
    status: 'SENT',
    retryCount: 0,
    createdAt: new Date(Date.now() - 120_000).toISOString(),
    sentAt: new Date(Date.now() - 90_000).toISOString(),
    leaseOwner: 'order-service',
  },
  {
    id: 3,
    topic: 'inventory-reservation-release-envelope-topic',
    msgKey: 'ORD-DEMO-1002',
    eventId: 'demo-release-1002',
    eventType: 'ReleaseReservationCommand',
    status: 'RETRY',
    retryCount: 1,
    createdAt: new Date(Date.now() - 300_000).toISOString(),
    nextAttemptAt: new Date(Date.now() + 60_000).toISOString(),
    leaseOwner: 'order-service',
    lastError: 'Demo fallback khi API outbox chưa bật.',
  },
];

function readString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function readNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeOutboxRow(payload: unknown): OutboxRecentRow {
  if (!isRecord(payload)) {
    return {
      id: 0,
      topic: '',
      eventId: '',
      eventType: '',
      status: 'UNKNOWN',
      retryCount: 0,
    };
  }

  return {
    id: readNumber(payload.id),
    topic: readString(payload.topic),
    msgKey: readString(payload.msgKey || payload.key),
    eventId: readString(payload.eventId),
    eventType: readString(payload.eventType),
    status: readString(payload.status, 'UNKNOWN').toUpperCase(),
    retryCount: readNumber(payload.retryCount),
    createdAt: readString(payload.createdAt),
    sentAt: readString(payload.sentAt),
    nextAttemptAt: readString(payload.nextAttemptAt),
    leaseUntil: readString(payload.leaseUntil),
    leaseOwner: readString(payload.leaseOwner),
    lastError: readString(payload.lastError),
  };
}

function normalizeFilter(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function matchesFallbackFilter(row: OutboxRecentRow, filters?: OutboxRecentFilters): boolean {
  const msgKey = normalizeFilter(filters?.msgKey)?.toUpperCase();
  const eventType = normalizeFilter(filters?.eventType);
  const topic = normalizeFilter(filters?.topic);

  if (msgKey && (row.msgKey || '').toUpperCase() !== msgKey) {
    return false;
  }

  if (eventType && row.eventType !== eventType) {
    return false;
  }

  if (topic && row.topic !== topic) {
    return false;
  }

  return true;
}

export const frameworkEvidenceApi = {
  async getSkuOptions(limit = 12): Promise<FrameworkSkuOption[]> {
    const products = await productApi.getAll();

    const variants = products.flatMap((product) =>
      (product.variants || []).map((variant: ProductVariant) => ({
        skuCode: variant.skuCode,
        label: `${variant.skuCode} • ${product.name}`,
        productName: product.name,
        color: variant.color,
        size: variant.size,
      })),
    );

    return variants.slice(0, limit);
  },

  async getRecentOutbox(
    limit = 8,
    filters: OutboxRecentFilters = {},
  ): Promise<{ rows: OutboxRecentRow[]; source: 'api' | 'fallback' }> {
    const params = {
      limit,
      ...(normalizeFilter(filters.msgKey) ? { msgKey: normalizeFilter(filters.msgKey) } : {}),
      ...(normalizeFilter(filters.eventType) ? { eventType: normalizeFilter(filters.eventType) } : {}),
      ...(normalizeFilter(filters.topic) ? { topic: normalizeFilter(filters.topic) } : {}),
    };

    try {
      const response = await axiosClient.get('/api/system/outbox', { params });
      const payload = response?.data ?? response;

      const raw = Array.isArray(payload)
        ? payload
        : isRecord(payload) && Array.isArray(payload.items)
          ? payload.items
          : [];

      const rows = raw
        .map(normalizeOutboxRow)
        .filter((row) => row.id || row.eventId);

      return { rows, source: 'api' };
    } catch (error) {
      console.error('Outbox API failed, using fallback:', error);
    }

    return {
      rows: FALLBACK_OUTBOX_ROWS.filter((row) => matchesFallbackFilter(row, filters)).slice(0, limit),
      source: 'fallback',
    };
  },
};
