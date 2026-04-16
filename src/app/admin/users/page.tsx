'use client';

import { useEffect, useMemo, useState } from 'react';
import { App as AntdApp, Avatar, Card, Switch, Table, Tag, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { MailOutlined, PhoneOutlined } from '@ant-design/icons';
import { UserResponse, userManagementApi } from '@/services/userManagementApi';
import { useAuthStore } from '@/store/useAuthStore';
import { hasAdminRole } from '@/lib/auth';

export default function AdminUserPage() {
  const { message } = AntdApp.useApp();
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuthStore();

  const canManageUsers = hasAdminRole(user?.roles);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await userManagementApi.getAll();
      setUsers(data);
    } catch (error) {
      console.error(error);
      message.error('Không tải được danh sách người dùng.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchUsers();
  }, [message]);

  const handleStatusChange = async (record: UserResponse, checked: boolean) => {
    if (!canManageUsers) {
      message.warning('Chỉ quản trị viên mới có thể thay đổi trạng thái tài khoản.');
      return;
    }

    if (record.id === user?.id || record.email === user?.email) {
      message.info('Bạn không thể tự khóa tài khoản quản trị đang đăng nhập.');
      return;
    }

    try {
      await userManagementApi.updateStatus(record.id, checked);
      message.success(`Đã ${checked ? 'mở khóa' : 'khóa'} tài khoản thành công.`);
      setUsers((previous) => previous.map((item) => (item.id === record.id ? { ...item, status: checked } : item)));
    } catch (error) {
      console.error(error);
      message.error('Cập nhật trạng thái thất bại.');
    }
  };

  const activeUsers = useMemo(() => users.filter((item) => item.status).length, [users]);

  const columns: ColumnsType<UserResponse> = [
    {
      title: 'Người dùng',
      key: 'user',
      render: (_, record) => (
        <div className="flex items-center gap-3">
          <Avatar className="!bg-[var(--color-primary)]">{record.fullName ? record.fullName.charAt(0).toUpperCase() : 'U'}</Avatar>
          <div>
            <div className="font-semibold text-[var(--color-primary)]">{record.fullName || 'Chưa cập nhật tên'}</div>
            <div className="text-sm text-[var(--color-secondary)]">@{record.email.split('@')[0]}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Liên hệ',
      key: 'contact',
      render: (_, record) => (
        <div className="space-y-1 text-sm text-[var(--color-secondary)]">
          <div className="flex items-center gap-2">
            <MailOutlined /> {record.email}
          </div>
          {record.phoneNumber ? (
            <div className="flex items-center gap-2">
              <PhoneOutlined /> {record.phoneNumber}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      title: 'Vai trò',
      key: 'role',
      width: 140,
      render: (_, record) => <Tag color={(record.roles ?? []).includes('admin') ? 'purple' : 'default'}>{(record.roles ?? [record.role || 'user'])[0] || 'user'}</Tag>,
    },
    {
      title: 'Địa chỉ',
      dataIndex: 'address',
      key: 'address',
      render: (text?: string) => text || <span className="text-[var(--color-muted)]">Chưa cập nhật</span>,
    },
    {
      title: 'Trạng thái',
      key: 'status',
      width: 180,
      render: (_, record) => {
        const isSelf = record.id === user?.id || record.email === user?.email;

        return (
          <div className="flex flex-col gap-2">
            <Tag color={record.status ? 'green' : 'red'}>{record.status ? 'Hoạt động' : 'Đã khóa'}</Tag>
            <Tooltip title={isSelf ? 'Không thể tự khóa tài khoản đang đăng nhập' : 'Chỉ quản trị viên mới có quyền cập nhật'}>
              <Switch
                checked={record.status}
                disabled={!canManageUsers || isSelf}
                onChange={(checked) => void handleStatusChange(record, checked)}
                checkedChildren="On"
                unCheckedChildren="Off"
              />
            </Tooltip>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="app-admin-card px-6 py-6 md:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">Người dùng</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Quản lý tài khoản</h1>
            <p className="mt-3 text-sm leading-6 text-[var(--color-secondary)]">Quản trị viên có thể khóa hoặc mở lại tài khoản của người khác ngay tại bảng này.</p>
          </div>
          <div className="flex gap-3 text-sm">
            <span className="app-status-pill">{users.length} tài khoản</span>
            <span className="app-status-pill">{activeUsers} đang hoạt động</span>
          </div>
        </div>
      </div>

      <Card className="app-admin-card border-0">
        <Table columns={columns} dataSource={users} rowKey="id" loading={loading} pagination={{ pageSize: 8 }} scroll={{ x: 980 }} />
      </Card>
    </div>
  );
}
