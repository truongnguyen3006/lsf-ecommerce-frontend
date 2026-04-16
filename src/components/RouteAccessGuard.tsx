'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Spin } from 'antd';
import { hasAdminRole } from '@/lib/auth';
import { useAuthStore } from '@/store/useAuthStore';

export default function RouteAccessGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, hasHydrated } = useAuthStore();

  const isAdminArea = pathname.startsWith('/admin');
  const isAuthPage = pathname === '/login' || pathname === '/register';
  const isAdmin = hasAdminRole(user?.roles);

  useEffect(() => {
    if (!hasHydrated || !isAuthenticated) {
      return;
    }

    if (isAdmin && !isAdminArea) {
      router.replace('/admin');
      return;
    }

    if (!isAdmin && isAuthPage) {
      router.replace('/');
    }
  }, [hasHydrated, isAdmin, isAdminArea, isAuthPage, isAuthenticated, router]);

  if (!hasHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-surface-elevated)]">
        <div className="flex flex-col items-center gap-3">
          <Spin size="large" />
          <p className="text-sm text-[var(--color-secondary)]">Đang đồng bộ phiên đăng nhập…</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated && ((isAdmin && !isAdminArea) || (!isAdmin && isAuthPage))) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-surface-elevated)]">
        <div className="flex flex-col items-center gap-3">
          <Spin size="large" />
          <p className="text-sm text-[var(--color-secondary)]">Đang chuyển hướng…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
