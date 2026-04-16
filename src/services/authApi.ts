import axiosClient from '@/lib/axiosClient';
import { UserProfile } from '@/store/useAuthStore';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  address: string;
}

export interface UpdateProfileRequest {
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  address?: string;
  password?: string;
}

export interface KeycloakTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export const authApi = {
  login: (data: LoginRequest) =>
    axiosClient.post<KeycloakTokenResponse, KeycloakTokenResponse>('/auth/login', data),

  register: (data: RegisterRequest) =>
    axiosClient.post<UserProfile, UserProfile>('/auth/register', data),

  getMe: () => axiosClient.get<UserProfile, UserProfile>('/api/user/me'),

  refreshToken: (token: string): Promise<KeycloakTokenResponse> =>
    axiosClient.post<KeycloakTokenResponse, KeycloakTokenResponse>('/auth/refresh', {
      refreshToken: token,
    }),

  updateProfile: (data: UpdateProfileRequest): Promise<UserProfile> =>
    axiosClient.patch<UserProfile, UserProfile>('/api/user/me', data),
};
