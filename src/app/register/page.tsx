'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { App as AntdApp, Button, Form, Input, Typography } from 'antd';
import { authApi, RegisterRequest } from '@/services/authApi';

const { Title } = Typography;

export default function RegisterPage() {
  const router = useRouter();
  const { message } = AntdApp.useApp();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: RegisterRequest) => {
    setLoading(true);
    try {
      await authApi.register(values);
      message.success('Đăng ký thành công! Vui lòng đăng nhập.');
      router.push('/login');
    } catch (error) {
      console.error(error);
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || 'Đăng ký thất bại, vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fbfbfb_0%,#f1f1f1_100%)] px-4 py-10">
      <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-[32px] border border-[var(--color-border)] bg-white shadow-[var(--shadow-strong)]">
        <div className="grid lg:grid-cols-[0.84fr_1.16fr]">
          <section className="border-b border-[var(--color-border)] bg-[var(--color-surface-muted)] p-8 lg:border-b-0 lg:border-r lg:p-10">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">
              Thành viên mới
            </div>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">Tạo tài khoản mới.</h1>
          </section>

          <section className="p-5 md:p-8 lg:p-10">
            <div className="mb-8">
              <Title level={2} className="!mb-2 !font-semibold !tracking-tight">
                Đăng ký tài khoản
              </Title>
            </div>

            <Form<RegisterRequest>
              name="register-form"
              layout="vertical"
              size="large"
              requiredMark={false}
              onFinish={onFinish}
              scrollToFirstError
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Form.Item
                  label="Tên đăng nhập"
                  name="username"
                  rules={[{ required: true, message: 'Vui lòng nhập username.' }]}
                >
                  <Input placeholder="Ví dụ: user_123" />
                </Form.Item>
                <Form.Item
                  label="Mật khẩu"
                  name="password"
                  rules={[
                    { required: true, message: 'Vui lòng nhập mật khẩu.' },
                    { min: 6, message: 'Mật khẩu ít nhất 6 ký tự.' },
                  ]}
                >
                  <Input.Password placeholder="Nhập mật khẩu" />
                </Form.Item>
              </div>

              <Form.Item
                label="Họ và tên"
                name="fullName"
                rules={[{ required: true, message: 'Vui lòng nhập họ và tên.' }]}
              >
                <Input placeholder="Nhập họ tên đầy đủ" />
              </Form.Item>

              <div className="grid gap-4 md:grid-cols-2">
                <Form.Item
                  label="Email"
                  name="email"
                  rules={[
                    { type: 'email', message: 'Email không hợp lệ.' },
                    { required: true, message: 'Vui lòng nhập email.' },
                  ]}
                >
                  <Input placeholder="name@example.com" />
                </Form.Item>
                <Form.Item
                  label="Số điện thoại"
                  name="phoneNumber"
                  rules={[{ required: true, message: 'Vui lòng nhập số điện thoại.' }]}
                >
                  <Input placeholder="09xxxxxxxx" />
                </Form.Item>
              </div>

              <Form.Item
                label="Địa chỉ nhận hàng"
                name="address"
                rules={[{ required: true, message: 'Vui lòng nhập địa chỉ.' }]}
              >
                <Input.TextArea
                  rows={4}
                  placeholder="Số nhà, đường, phường/xã, quận/huyện…"
                  className="!resize-none"
                />
              </Form.Item>

              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                className="!mt-2 !h-12 !bg-[var(--color-primary)] !shadow-none"
              >
                Tạo tài khoản
              </Button>
            </Form>

            <div className="mt-6 text-center text-sm text-[var(--color-secondary)]">
              Đã có tài khoản?{' '}
              <Link
                href="/login"
                className="font-semibold text-[var(--color-primary)] underline-offset-4 transition hover:underline"
              >
                Đăng nhập ngay
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
