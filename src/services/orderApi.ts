import axiosClient from '@/lib/axiosClient';
import { isRecord, readNumber, readString, unwrapCollection } from '@/lib/api-normalizers';

export interface OrderRequest {
  items: {
    skuCode: string;
    quantity: number;
  }[];
}

export interface OrderPlacementResponse {
  orderNumber: string;
  message: string;
}

export interface OrderLineItem {
  id: number | string;
  skuCode: string;
  price: number;
  quantity: number;
  productName: string;
  color: string;
  size: string;
}

export interface OrderResponse {
  id: number | string;
  orderNumber: string;
  status: string;
  totalPrice: number;
  orderDate: string;
  orderLineItemsList: OrderLineItem[];
  userId?: string;
  customerName?: string;
  customerEmail?: string;
}

function normalizeOrderLineItem(payload: unknown): OrderLineItem {
  if (!isRecord(payload)) {
    return {
      id: '',
      skuCode: '',
      price: 0,
      quantity: 0,
      productName: '',
      color: '',
      size: '',
    };
  }

  return {
    id: String(payload.id ?? payload.skuCode ?? ''),
    skuCode: readString(payload.skuCode || payload.sku),
    price: readNumber(payload.price ?? payload.unitPrice),
    quantity: readNumber(payload.quantity),
    productName: readString(payload.productName || payload.name),
    color: readString(payload.color),
    size: readString(payload.size),
  };
}

function normalizeOrder(payload: unknown): OrderResponse {
  if (!isRecord(payload)) {
    return {
      id: '',
      orderNumber: '',
      status: 'PENDING',
      totalPrice: 0,
      orderDate: '',
      orderLineItemsList: [],
    };
  }

  const rawItems = unwrapCollection<unknown>(
    payload.orderLineItemsList ?? payload.orderItems ?? payload.lineItems ?? payload.items,
    ['orderLineItemsList', 'orderItems', 'lineItems', 'items'],
  );

  const orderNumber = readString(payload.orderNumber || payload.orderCode || payload.code || payload.id);

  return {
    id: String(payload.id ?? orderNumber),
    orderNumber,
    status: readString(payload.status, 'PENDING').toUpperCase(),
    totalPrice: readNumber(payload.totalPrice ?? payload.totalAmount ?? payload.amount),
    orderDate: readString(payload.orderDate || payload.createdAt || payload.createdDate),
    orderLineItemsList: rawItems.map(normalizeOrderLineItem),
    userId: readString(payload.userId || payload.accountId),
    customerName: readString(payload.customerName || payload.fullName || payload.username),
    customerEmail: readString(payload.customerEmail || payload.email),
  };
}

async function fetchOrdersFromEndpoint(endpoint: string): Promise<OrderResponse[]> {
  const response = await axiosClient.get<unknown, unknown>(endpoint);
  return unwrapCollection<unknown>(response, ['content', 'items', 'data', 'orders']).map(normalizeOrder);
}

export const orderApi = {
  placeOrder: (data: OrderRequest) =>
    axiosClient.post<OrderPlacementResponse, OrderPlacementResponse>('/api/order', data),

  getAllOrders: async (): Promise<OrderResponse[]> => {
    return fetchOrdersFromEndpoint('/api/order');
  },

  getAdminOrders: async (): Promise<OrderResponse[]> => {
    const candidates = ['/api/order/admin', '/api/order'];

    for (const endpoint of candidates) {
      try {
        const orders = await fetchOrdersFromEndpoint(endpoint);
        if (orders.length > 0 || endpoint === '/api/order') {
          return orders;
        }
      } catch {
        // thử endpoint tiếp theo
      }
    }

    return [];
  },

  getOrderById: async (orderNumber: string): Promise<OrderResponse> => {
    const response = await axiosClient.get<unknown, unknown>(`/api/order/${orderNumber}`);
    return normalizeOrder(response);
  },
};
