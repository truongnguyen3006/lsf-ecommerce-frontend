'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar, Button, Card, Form, Input, Skeleton, Tag, Typography, message } from 'antd';
import {
  EditOutlined,
  MailOutlined,
  PhoneOutlined,
  RollbackOutlined,
  SafetyCertificateOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import { useAuthStore } from '@/store/useAuthStore';
import { UpdateProfileRequest, authApi } from '@/services/authApi';

const { Title, Text } = Typography;

export default function ProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, login } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm<UpdateProfileRequest>();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    if (user) {
      form.setFieldsValue({
        fullName: user.fullName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        address: user.address,
      });
    }
  }, [form, isAuthenticated, router, user]);

  const joinedLabel = useMemo(() => new Date().getFullYear().toString(), []);

  const handleUpdate = async (values: UpdateProfileRequest) => {
    setLoading(true);
    try {
      const updatedUser = await authApi.updateProfile(values);
      const currentToken = sessionStorage.getItem('access_token');

      if (currentToken) {
        login(currentToken, updatedUser);
      }

      message.success('Cập nhật thông tin thành công.');
      setIsEditing(false);
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response) {
        message.error(error.response.data?.message || 'Có lỗi xảy ra khi cập nhật.');
      } else if (error instanceof Error) {
        message.error(error.message);
      } else {
        message.error('Lỗi không xác định.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="app-shell py-10">
        <div className="app-surface p-6">
          <Skeleton active paragraph={{ rows: 10 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell animate-fade-in py-8 md:py-10">
      <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">Tài khoản của tôi</div>
          <Title level={2} className="!mb-2 !mt-2 !font-semibold !tracking-tight">
            Hồ sơ cá nhân
          </Title>
          <Text className="text-[var(--color-secondary)]">Cập nhật thông tin liên hệ để thanh toán và giao hàng thuận tiện hơn.</Text>
        </div>
        {!isEditing ? (
          <Button icon={<EditOutlined />} onClick={() => setIsEditing(true)}>
            Chỉnh sửa hồ sơ
          </Button>
        ) : null}
      </div>

      <Card className="app-surface border-0" bodyStyle={{ padding: 0 }}>
        <div className="grid lg:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="border-b border-[var(--color-border)] bg-[var(--color-surface-muted)] p-8 lg:border-b-0 lg:border-r">
            <div className="flex flex-col items-center text-center">
              <Avatar size={124} className="!bg-[var(--color-primary)] !text-white">
                {(user.fullName || user.username || 'U').charAt(0).toUpperCase()}
              </Avatar>
              <h2 className="mt-5 text-2xl font-semibold tracking-tight">{user.fullName || user.username}</h2>
              <p className="mt-2 text-sm text-[var(--color-secondary)]">{user.email || 'Email đang cập nhật'}</p>
              <Tag icon={<SafetyCertificateOutlined />} className="!mt-4 !rounded-full !border-0 !bg-[var(--color-primary)] !px-4 !py-1.5 !text-white">
                Thành viên hệ thống
              </Tag>
            </div>

            <div className="mt-8 space-y-3 text-sm text-[var(--color-secondary)]">
              <div className="rounded-[22px] border border-[var(--color-border)] bg-white p-4">
                <div className="font-semibold text-[var(--color-primary)]">Tên đăng nhập</div>
                <div className="mt-1">{user.username || 'Đang cập nhật'}</div>
              </div>
              <div className="rounded-[22px] border border-[var(--color-border)] bg-white p-4">
                <div className="font-semibold text-[var(--color-primary)]">Thành viên từ</div>
                <div className="mt-1">{joinedLabel}</div>
              </div>
            </div>
          </aside>

          <section className="p-6 md:p-8">
            <Form<UpdateProfileRequest> form={form} layout="vertical" onFinish={handleUpdate} disabled={!isEditing} requiredMark={false} size="large">
              <div className="grid gap-4 md:grid-cols-2">
                <Form.Item label="Họ và tên" name="fullName" rules={[{ required: true, message: 'Vui lòng nhập họ tên.' }]}>
                  <Input placeholder="Nhập họ tên" />
                </Form.Item>
                <Form.Item label="Email" name="email" rules={[{ type: 'email', message: 'Email không hợp lệ.' }]}>
                  <Input prefix={<MailOutlined className="text-[var(--color-muted)]" />} placeholder="name@example.com" />
                </Form.Item>
              </div>

              <Form.Item label="Số điện thoại" name="phoneNumber">
                <Input prefix={<PhoneOutlined className="text-[var(--color-muted)]" />} placeholder="09xxxxxxxx" />
              </Form.Item>

              <Form.Item label="Địa chỉ" name="address">
                <Input.TextArea rows={4} className="!resize-none" placeholder="Số nhà, đường, phường/xã, quận/huyện…" />
              </Form.Item>

              {isEditing ? (
                <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-[var(--color-border)] pt-6">
                  <Button
                    icon={<RollbackOutlined />}
                    onClick={() => {
                      setIsEditing(false);
                      form.setFieldsValue({
                        fullName: user.fullName,
                        email: user.email,
                        phoneNumber: user.phoneNumber,
                        address: user.address,
                      });
                    }}
                  >
                    Hủy
                  </Button>
                  <Button type="primary" htmlType="submit" loading={loading} icon={<SaveOutlined />} className="!bg-[var(--color-primary)] !shadow-none">
                    Lưu thay đổi
                  </Button>
                </div>
              ) : (
                <div className="mt-4 rounded-[22px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 text-sm leading-6 text-[var(--color-secondary)]">
                  Thông tin tại đây sẽ được dùng cho quá trình chăm sóc khách hàng và giao nhận đơn hàng.
                </div>
              )}
            </Form>
          </section>
        </div>
      </Card>
    </div>
  );
}
