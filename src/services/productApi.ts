import axiosClient from '@/lib/axiosClient';
import { Product, CreateProductRequest } from '@/types';
import { unwrapCollection } from '@/lib/api-normalizers';

export const productApi = {
  getAll: async (): Promise<Product[]> => {
    const response = await axiosClient.get<unknown, unknown>('/api/product');
    return unwrapCollection<Product>(response, ['content', 'items', 'data', 'products']);
  },

  getById: async (id: number | string): Promise<Product> =>
    axiosClient.get<Product, Product>(`/api/product/${id}`),

  create: async (data: CreateProductRequest): Promise<Product> =>
    axiosClient.post<Product, Product>('/api/product', data),

  update: async (id: number | string, data: Partial<CreateProductRequest>): Promise<Product> =>
    axiosClient.put<Product, Product>(`/api/product/${id}`, data),

  delete: async (id: number | string): Promise<void> =>
    axiosClient.delete<void, void>(`/api/product/${id}`),
};
