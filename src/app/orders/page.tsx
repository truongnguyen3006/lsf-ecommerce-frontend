'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Empty, Result, Skeleton, Steps, Tag, Typography } from 'antd';
import { ShoppingOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/store/useAuthStore';
import { orderApi } from '@/services/orderApi';
import { getOrderStatusMeta, getOrderTrackingSteps } from '@/lib/order-status';

const { Text } = Typography;

function formatMoney(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(value);
}

export default function OrdersPage() {
  const { isAuthenticated } = useAuthStore();

  const { data: orders, isLoading, isError } = useQuery({
    queryKey: ['customer-orders'],
    queryFn: () => orderApi.getAllOrders(),
    enabled: isAuthenticated,
    retry: 0,
  });

  const sortedOrders = useMemo(
    () =>
      [...(orders ?? [])].sort(
        (a, b) => new Date(b.orderDate || 0).getTime() - new Date(a.orderDate || 0).getTime(),
      ),
    [orders],
  );

  if (!isAuthenticated) {
    return (
      <div className="app-shell animate-fade-in py-8 md:py-10">
        <div className="app-surface px-6 py-10 md:px-8">
          <Result
            status="info"
            title="Đăng nhập để xem đơn hàng"
            subTitle="Bạn cần đăng nhập để theo dõi các đơn đã đặt."
            extra={
              <div className="flex flex-wrap justify-center gap-3">
                <Link href="/login" className="app-primary-btn">
                  Đăng nhập
                </Link>
                <Link href="/products" className="app-secondary-btn">
                  Xem sản phẩm
                </Link>
              </div>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell animate-fade-in py-8 md:py-10">
      <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">
            Đơn hàng của tôi
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Theo dõi đơn hàng</h1>
        </div>
        <Link href="/products" className="app-secondary-btn">
          Xem sản phẩm
        </Link>
      </div>

      {isLoading ? (
        <div className="grid gap-6">
          {Array.from({ length: 2 }).map((_, index) => (
            <Card key={index} className="app-surface border-0">
              <Skeleton active paragraph={{ rows: 5 }} />
            </Card>
          ))}
        </div>
      ) : isError ? (
        <div className="app-surface px-6 py-10">
          <Result status="warning" title="Chưa thể tải danh sách đơn hàng" subTitle="Vui lòng thử lại sau." />
        </div>
      ) : sortedOrders.length > 0 ? (
        <div className="grid gap-6">
          {sortedOrders.map((order) => {
            const meta = getOrderStatusMeta(order.status);
            const steps = getOrderTrackingSteps(order);
            const processIndex = steps.findIndex((step) => step.status === 'process');
            const currentStep = processIndex >= 0 ? processIndex : meta.step - 1;

            return (
              <Card key={String(order.id || order.orderNumber)} className="app-surface border-0">
                <div className="flex flex-col gap-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">
                        Mã đơn hàng
                      </div>
                      <div className="mt-2 text-xl font-semibold tracking-tight text-[var(--color-primary)]">
                        {order.orderNumber}
                      </div>
                      <div className="mt-2 text-sm text-[var(--color-secondary)]">
                        {order.orderDate
                          ? new Date(order.orderDate).toLocaleString('vi-VN')
                          : 'Đang cập nhật thời gian'}
                      </div>
                    </div>

                    <div className="text-left md:text-right">
                      <Tag color={meta.color}>{meta.label}</Tag>
                      <div className="mt-2 text-2xl font-semibold tracking-tight">
                        {formatMoney(order.totalPrice || 0)}
                      </div>
                    </div>
                  </div>

                  <Steps current={currentStep} items={steps} responsive />

                  <div className="rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 text-sm text-[var(--color-secondary)]">
                    {meta.description}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {order.orderLineItemsList.length > 0 ? (
                      order.orderLineItemsList.map((item) => (
                        <div
                          key={String(item.id || item.skuCode)}
                          className="rounded-[22px] border border-[var(--color-border)] bg-white p-4"
                        >
                          <div className="text-sm font-semibold text-[var(--color-primary)]">
                            {item.productName || 'Sản phẩm'}
                          </div>
                          <div className="mt-2 text-sm text-[var(--color-secondary)]">
                            {item.color || '—'} • {item.size || '—'} • SL {item.quantity}
                          </div>
                          <Text className="mt-2 block font-semibold text-[var(--color-primary)]">
                            {formatMoney(item.price * item.quantity)}
                          </Text>
                        </div>
                      ))
                    ) : (
                      <Empty description="Chưa có chi tiết sản phẩm" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="app-surface px-6 py-12">
          <Empty
            image={<ShoppingOutlined className="text-6xl text-[var(--color-muted)]" />}
            description="Bạn chưa có đơn hàng nào"
          >
            <Link href="/products" className="app-primary-btn">
              Bắt đầu mua sắm
            </Link>
          </Empty>
        </div>
      )}
    </div>
  );
}
