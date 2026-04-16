import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { jwtDecode } from 'jwt-decode';
import { normalizeRoles } from '@/lib/auth';

export interface UserProfile {
  id?: number;
  keycloakId?: string;
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  address?: string;
  status?: boolean;
  username?: string;
  roles?: string[];
}

interface KeycloakTokenPayload {
  sub: string;
  preferred_username: string;
  realm_access?: {
    roles: string[];
  };
}

interface AuthState {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  hasHydrated: boolean;
  login: (token: string, dbUser?: UserProfile) => void;
  syncToken: (token: string) => void;
  logout: () => void;
  setHasHydrated: (value: boolean) => void;
}

function buildUserFromToken(
  token: string,
  dbUser?: UserProfile,
  currentUser?: UserProfile | null,
): UserProfile {
  const decoded = jwtDecode<KeycloakTokenPayload>(token);

  return {
    id: dbUser?.id ?? currentUser?.id,
    keycloakId: decoded.sub,
    fullName: dbUser?.fullName ?? currentUser?.fullName,
    email: dbUser?.email ?? currentUser?.email,
    phoneNumber: dbUser?.phoneNumber ?? currentUser?.phoneNumber,
    address: dbUser?.address ?? currentUser?.address,
    status: dbUser?.status ?? currentUser?.status,
    username: decoded.preferred_username || dbUser?.username || currentUser?.username,
    roles: normalizeRoles(decoded.realm_access?.roles ?? dbUser?.roles ?? currentUser?.roles),
  };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      hasHydrated: false,

      setHasHydrated: (value) => set({ hasHydrated: value }),

      login: (token, dbUser) => {
        try {
          const finalUser = buildUserFromToken(token, dbUser, get().user);

          set({ user: finalUser, token, isAuthenticated: true });

          if (typeof window !== 'undefined') {
            sessionStorage.setItem('access_token', token);
          }
        } catch (error) {
          console.error('Lỗi decode token:', error);
        }
      },

      syncToken: (token) => {
        try {
          const finalUser = buildUserFromToken(token, undefined, get().user);
          set({ user: finalUser, token, isAuthenticated: true });

          if (typeof window !== 'undefined') {
            sessionStorage.setItem('access_token', token);
          }
        } catch (error) {
          console.error('Lỗi đồng bộ token:', error);
        }
      },

      logout: () => {
        set({ user: null, token: null, isAuthenticated: false });
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('access_token');
          sessionStorage.removeItem('refresh_token');
          sessionStorage.removeItem('flash-sale-auth');
        }
      },
    }),
    {
      name: 'flash-sale-auth',
      storage: createJSONStorage(() => sessionStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
