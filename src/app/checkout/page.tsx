'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Divider, Empty, Spin, message } from 'antd';
import { DeleteOutlined, ShoppingOutlined } from '@ant-design/icons';
import { useCartStore } from '@/store/useCartStore';
import { useAuthStore } from '@/store/useAuthStore';
import { orderApi } from '@/services/orderApi';
import QuantityStepper from '@/components/ui/QuantityStepper';

function formatMoney(amount: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount);
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items, removeFromCart, updateQuantity, totalPrice, clearCart } = useCartStore();
  const { isAuthenticated } = useAuthStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : null;
    if (!isAuthenticated && !token) {
      message.warning('Vui lòng đăng nhập để thanh toán.');
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  const token = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : null;

  const subtotal = useMemo(() => totalPrice(), [items, totalPrice]);
  const shippingFee = 0;
  const finalTotal = subtotal + shippingFee;
  const itemCount = items.reduce((total, item) => total + item.quantity, 0);

  const handlePlaceOrder = async () => {
    if (!items.length) return;

    setIsSubmitting(true);
    try {
      const payload = {
        items: items.map((item) => ({
          skuCode: item.skuCode,
          quantity: item.quantity,
        })),
      };

      const response = await orderApi.placeOrder(payload);
      message.success('Đơn hàng đã được gửi sang hệ thống xử lý.');
      clearCart();
      router.push(`/checkout/waiting/${response.orderNumber}`);
    } catch (error) {
      console.error(error);
      message.error('Đặt hàng thất bại. Vui lòng thử lại sau.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAuthenticated && !token) {
    return (
      <div className="app-shell py-10">
        <div className="app-surface flex min-h-[320px] items-center justify-center">
          <Spin size="large" />
        </div>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="app-shell animate-fade-in py-10">
        <div className="app-surface px-6 py-12">
          <Empty image={<ShoppingOutlined className="text-6xl text-[var(--color-muted)]" />} description="Giỏ hàng của bạn đang trống">
            <Link href="/products" className="app-primary-btn">
              Khám phá sản phẩm
            </Link>
          </Empty>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell animate-fade-in py-8 md:py-10">
      <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">Thanh toán</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Xác nhận giỏ hàng</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--color-secondary)]">Kiểm tra lại sản phẩm, số lượng và tổng thanh toán trước khi đặt hàng.</p>
        </div>
        <span className="app-status-pill">{itemCount} sản phẩm trong đơn</span>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="app-surface overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-5">
            <div>
              <h2 className="text-xl font-semibold">Sản phẩm trong giỏ</h2>
              <p className="mt-1 text-sm text-[var(--color-secondary)]">Bạn có thể chỉnh số lượng trực tiếp trước khi đặt hàng.</p>
            </div>
            <Link href="/products" className="text-sm font-semibold text-[var(--color-primary)] transition hover:opacity-70">
              Tiếp tục mua sắm
            </Link>
          </div>

          <div className="divide-y divide-[var(--color-border)]">
            {items.map((item) => (
              <article key={item.skuCode} className="grid gap-4 px-6 py-5 md:grid-cols-[120px_minmax(0,1fr)] md:items-center">
                <div className="overflow-hidden rounded-[24px] bg-[var(--color-surface-muted)]">
                  <img src={item.imageUrl} alt={item.name} className="h-28 w-full object-cover" />
                </div>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <Link href={`/product/${item.id}`} className="text-lg font-semibold tracking-tight transition hover:opacity-70">
                        {item.name}
                      </Link>
                      <div className="mt-2 flex flex-wrap gap-2 text-sm text-[var(--color-secondary)]">
                        {item.category ? <span className="app-status-pill">{item.category}</span> : null}
                        {item.selectedColor ? <span className="app-status-pill">Màu: {item.selectedColor}</span> : null}
                        {item.selectedSize ? <span className="app-status-pill">Size: {item.selectedSize}</span> : null}
                      </div>
                    </div>
                    <div className="text-left md:text-right">
                      <div className="text-base font-semibold">{formatMoney(item.price * item.quantity)}</div>
                      <div className="mt-1 text-sm text-[var(--color-secondary)]">{formatMoney(item.price)} / sản phẩm</div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <QuantityStepper value={item.quantity} onChange={(value) => updateQuantity(item.skuCode, value)} />
                    <Button
                      type="text"
                      icon={<DeleteOutlined />}
                      onClick={() => removeFromCart(item.skuCode)}
                      className="!h-auto !px-0 text-[var(--color-secondary)] hover:!text-[var(--color-danger)]"
                    >
                      Xóa khỏi giỏ hàng
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside className="app-surface p-6 md:p-8 xl:sticky xl:top-24 xl:h-fit">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">Tóm tắt thanh toán</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">Đơn hàng của bạn</h2>

          <div className="mt-6 space-y-4 text-sm text-[var(--color-secondary)]">
            <div className="flex items-center justify-between">
              <span>Tạm tính</span>
              <span className="font-semibold text-[var(--color-primary)]">{formatMoney(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Vận chuyển</span>
              <span className="font-semibold text-[var(--color-success)]">Miễn phí</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Phí phát sinh</span>
              <span className="font-semibold text-[var(--color-primary)]">0đ</span>
            </div>
          </div>

          <Divider className="my-6" />

          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-[var(--color-secondary)]">Tổng thanh toán</div>
              <div className="mt-1 text-xs text-[var(--color-muted)]">Đã bao gồm mọi chi phí hiển thị</div>
            </div>
            <div className="text-right text-3xl font-semibold tracking-tight">{formatMoney(finalTotal)}</div>
          </div>

          <div className="mt-6 rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 text-sm leading-6 text-[var(--color-secondary)]">
            Sau khi đặt hàng, hệ thống sẽ chuyển sang màn hình theo dõi trạng thái với thanh tiến độ trực quan giống các hệ thống thương mại điện tử hiện đại.
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <button type="button" onClick={handlePlaceOrder} disabled={isSubmitting} className="app-primary-btn w-full py-4 text-base">
              {isSubmitting ? 'Đang gửi đơn hàng…' : 'Đặt hàng ngay'}
            </button>
            <Link href="/products" className="app-secondary-btn w-full py-4 text-base">
              Quay lại danh mục
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
