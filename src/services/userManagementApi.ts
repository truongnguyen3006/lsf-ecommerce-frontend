import axiosClient from '@/lib/axiosClient';
import { normalizeRoles } from '@/lib/auth';
import {
  isRecord,
  readBoolean,
  readString,
  readStringArray,
  unwrapCollection,
} from '@/lib/api-normalizers';

export interface UserResponse {
  id: number;
  keycloakId: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  address: string;
  status: boolean;
  roles?: string[];
  role?: string;
}

function normalizeUser(payload: unknown): UserResponse {
  if (!isRecord(payload)) {
    return {
      id: 0,
      keycloakId: '',
      fullName: '',
      email: '',
      phoneNumber: '',
      address: '',
      status: false,
      roles: [],
      role: '',
    };
  }

  const roles = normalizeRoles([
    ...readStringArray(payload.roles),
    readString(payload.role),
  ]);

  return {
    id: Number(payload.id ?? 0),
    keycloakId: readString(payload.keycloakId || payload.sub),
    fullName: readString(payload.fullName || payload.name),
    email: readString(payload.email),
    phoneNumber: readString(payload.phoneNumber || payload.phone),
    address: readString(payload.address),
    status: readBoolean(payload.status ?? payload.enabled ?? payload.active, true),
    roles,
    role: roles[0] ?? '',
  };
}

export const userManagementApi = {
  getAll: async (): Promise<UserResponse[]> => {
    const response = await axiosClient.get<unknown, unknown>('/api/user');
    return unwrapCollection<unknown>(response, ['content', 'items', 'data', 'users']).map(normalizeUser);
  },

  updateStatus: async (id: number, enabled: boolean): Promise<UserResponse> => {
    const response = await axiosClient.patch<unknown, unknown>(`/api/user/admin/${id}/status`, { enabled });
    return normalizeUser(response);
  },
};
