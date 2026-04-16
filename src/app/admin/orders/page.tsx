'use client';

import { useEffect, useMemo, useState } from 'react';
import { App as AntdApp, Button, Card, Empty, Modal, Space, Statistic, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { EyeOutlined, ReloadOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import { orderApi, OrderResponse } from '@/services/orderApi';
import { getOrderStatusMeta } from '@/lib/order-status';

const { Text } = Typography;

function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN').format(value);
}

export default function AdminOrderPage() {
  const { message } = AntdApp.useApp();
  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderResponse | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const data = await orderApi.getAdminOrders();
      setOrders([...data].reverse());
    } catch (error) {
      console.error(error);
      message.error('Không thể tải danh sách đơn hàng.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchOrders();
  }, [message]);

  const totalRevenue = useMemo(() => orders.reduce((sum, order) => sum + (order.totalPrice || 0), 0), [orders]);
  const successOrders = useMemo(() => orders.filter((order) => ['COMPLETED', 'DELIVERED'].includes(order.status)).length, [orders]);

  const columns: ColumnsType<OrderResponse> = [
    {
      title: 'Mã đơn hàng',
      dataIndex: 'orderNumber',
      key: 'orderNumber',
      render: (text: string) => <span className="font-mono text-sm font-semibold text-[var(--color-primary)]">{text || '—'}</span>,
    },
    {
      title: 'Khách hàng',
      key: 'customer',
      render: (_, record) => (
        <div>
          <div className="font-medium text-[var(--color-primary)]">{record.customerName || 'Đang cập nhật'}</div>
          {record.customerEmail ? <div className="text-xs text-[var(--color-secondary)]">{record.customerEmail}</div> : null}
        </div>
      ),
    },
    {
      title: 'Số món',
      key: 'quantity',
      width: 100,
      render: (_, record) => `${record.orderLineItemsList.length} món`,
    },
    {
      title: 'Ngày đặt',
      dataIndex: 'orderDate',
      key: 'orderDate',
      render: (date: string) => <span className="text-sm text-[var(--color-secondary)]">{date ? new Date(date).toLocaleString('vi-VN') : '—'}</span>,
      sorter: (a, b) => new Date(a.orderDate || 0).getTime() - new Date(b.orderDate || 0).getTime(),
    },
    {
      title: 'Tổng tiền',
      dataIndex: 'totalPrice',
      key: 'totalPrice',
      render: (price: number) => <span className="font-semibold">{formatCurrency(price || 0)} đ</span>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const meta = getOrderStatusMeta(status);
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: 'Hành động',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Button
          icon={<EyeOutlined />}
          onClick={() => {
            setSelectedOrder(record);
            setIsModalOpen(true);
          }}
        >
          Chi tiết
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="app-admin-card px-6 py-6 md:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">Đơn hàng</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Quản lý đơn hàng</h1>
            <p className="mt-3 text-sm leading-6 text-[var(--color-secondary)]">Theo dõi tình trạng xử lý, doanh thu và chi tiết các đơn hàng gần đây.</p>
          </div>
          <Button icon={<ReloadOutlined />} onClick={() => void fetchOrders()}>
            Tải lại dữ liệu
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="app-admin-card border-0">
          <Statistic title="Tổng đơn hàng" value={orders.length} prefix={<ShoppingCartOutlined />} />
        </Card>
        <Card className="app-admin-card border-0">
          <Statistic title="Đơn hoàn tất" value={successOrders} />
        </Card>
        <Card className="app-admin-card border-0">
          <Statistic title="Doanh thu" value={`${formatCurrency(totalRevenue)} đ`} />
        </Card>
      </div>

      <Card className="app-admin-card border-0">
        <Table
          columns={columns}
          dataSource={orders}
          rowKey={(record) => String(record.id || record.orderNumber)}
          loading={loading}
          locale={{
            emptyText: <Empty description="Chưa có đơn hàng nào để hiển thị" />,
          }}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1100 }}
        />
      </Card>

      <Modal title={`Chi tiết đơn hàng ${selectedOrder?.orderNumber || ''}`} open={isModalOpen} onCancel={() => setIsModalOpen(false)} footer={null} width={860}>
        {selectedOrder ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 border-b border-[var(--color-border)] pb-4 md:flex-row md:items-center md:justify-between">
              <Space direction="vertical" size={2}>
                <Text strong>Mã đơn hàng: {selectedOrder.orderNumber}</Text>
                <Text type="secondary">ID: {selectedOrder.id}</Text>
                {selectedOrder.customerName ? <Text type="secondary">Khách hàng: {selectedOrder.customerName}</Text> : null}
              </Space>
              <Tag color={getOrderStatusMeta(selectedOrder.status).color}>{getOrderStatusMeta(selectedOrder.status).label}</Tag>
            </div>

            <Table
              dataSource={selectedOrder.orderLineItemsList}
              rowKey={(record) => String(record.id || record.skuCode)}
              pagination={false}
              size="middle"
              scroll={{ x: 720 }}
              columns={[
                { title: 'SKU', dataIndex: 'skuCode', render: (value: string) => <span className="font-mono text-xs">{value || '—'}</span> },
                { title: 'Sản phẩm', dataIndex: 'productName', render: (value: string) => value || 'Đang cập nhật' },
                { title: 'Màu / Size', render: (_, record) => `${record.color || '—'} / ${record.size || '—'}` },
                { title: 'SL', dataIndex: 'quantity', width: 80 },
                { title: 'Giá', dataIndex: 'price', render: (value: number) => `${formatCurrency(value)} đ` },
                {
                  title: 'Thành tiền',
                  render: (_, record) => <span className="font-semibold">{formatCurrency(record.price * record.quantity)} đ</span>,
                },
              ]}
            />

            <div className="flex justify-end border-t border-[var(--color-border)] pt-4 text-lg font-semibold">Tổng cộng: {formatCurrency(selectedOrder.totalPrice || 0)} đ</div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
