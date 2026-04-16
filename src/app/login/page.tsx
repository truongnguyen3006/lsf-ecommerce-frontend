'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { App as AntdApp, Button, Form, Input, Typography } from 'antd';
import axios from 'axios';
import { authApi, KeycloakTokenResponse, LoginRequest } from '@/services/authApi';
import { useAuthStore, UserProfile } from '@/store/useAuthStore';
import { hasAdminRole } from '@/lib/auth';

const { Title } = Typography;

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const { message } = AntdApp.useApp();
  const [loading, setLoading] = useState(false);

  const handleLogin = async (values: LoginRequest) => {
    try {
      setLoading(true);

      const res = (await authApi.login({
        username: values.username,
        password: values.password,
      })) as KeycloakTokenResponse;

      const accessToken = res.access_token;

      if (typeof window !== 'undefined') {
        sessionStorage.setItem('access_token', accessToken);
        if (res.refresh_token) {
          sessionStorage.setItem('refresh_token', res.refresh_token);
        }
      }

      let userProfile: UserProfile | undefined;

      try {
        userProfile = (await authApi.getMe()) as UserProfile;
      } catch (error) {
        console.error('Lỗi lấy thông tin user:', error);
      }

      login(accessToken, userProfile);

      const { user } = useAuthStore.getState();
      const isAdmin = hasAdminRole(user?.roles);

      if (isAdmin) {
        message.success(`Xin chào ${userProfile?.fullName || values.username}!`);
        router.replace('/admin');
        return;
      }

      message.success('Đăng nhập thành công!');
      router.replace('/');
    } catch (error) {
      if (!axios.isAxiosError(error) || error.response?.status !== 400) {
        console.error('Lỗi đăng nhập:', error);
      }

      const errorMessage = axios.isAxiosError(error)
        ? (error.response?.data?.message as string | undefined) ||
          'Đăng nhập thất bại! Vui lòng kiểm tra lại tài khoản hoặc mật khẩu.'
        : 'Đăng nhập thất bại! Vui lòng kiểm tra lại tài khoản hoặc mật khẩu.';

      message.error(errorMessage);
      sessionStorage.removeItem('access_token');
      sessionStorage.removeItem('refresh_token');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(17,17,17,0.08),_transparent_35%),linear-gradient(180deg,#ffffff_0%,#f7f7f7_100%)] px-4 py-10">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-6xl overflow-hidden rounded-[32px] border border-[var(--color-border)] bg-white shadow-[var(--shadow-strong)] lg:grid-cols-[1fr_0.92fr]">
        <section className="hidden bg-[#111111] p-10 text-white lg:flex lg:flex-col lg:justify-end">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-white/60">Flash Store</div>
            <h1 className="mt-5 text-5xl font-semibold tracking-tight">Đăng nhập để tiếp tục.</h1>
            <p className="mt-5 max-w-md text-base leading-7 text-white/75">
              Truy cập nhanh vào đơn hàng, hồ sơ cá nhân và khu vực quản trị nếu bạn có quyền.
            </p>
          </div>
        </section>

        <section className="flex items-center px-5 py-8 md:px-8 lg:px-10">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-8">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">
                Tài khoản
              </div>
              <Title level={2} className="!mb-2 !mt-2 !font-semibold !tracking-tight">
                Chào mừng bạn quay lại
              </Title>
            </div>

            <Form<LoginRequest> layout="vertical" onFinish={handleLogin} size="large" requiredMark={false}>
              <Form.Item<LoginRequest>
                label={<span className="font-semibold text-[var(--color-primary)]">Tên đăng nhập</span>}
                name="username"
                rules={[{ required: true, message: 'Vui lòng nhập username.' }]}
              >
                <Input placeholder="Nhập tên đăng nhập" />
              </Form.Item>

              <Form.Item<LoginRequest>
                label={<span className="font-semibold text-[var(--color-primary)]">Mật khẩu</span>}
                name="password"
                rules={[{ required: true, message: 'Vui lòng nhập mật khẩu.' }]}
              >
                <Input.Password placeholder="Nhập mật khẩu" />
              </Form.Item>

              <div className="mb-6 text-right text-sm">
                <Link
                  href="/register"
                  className="font-semibold text-[var(--color-primary)] underline-offset-4 transition hover:underline"
                >
                  Tạo tài khoản
                </Link>
              </div>

              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                className="!h-12 !bg-[var(--color-primary)] !shadow-none"
              >
                Đăng nhập
              </Button>
            </Form>
          </div>
        </section>
      </div>
    </div>
  );
}
