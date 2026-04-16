'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Result, Skeleton } from 'antd';
import ProductCard from '@/components/ProductCard';
import { productApi } from '@/services/productApi';
import { Product } from '@/types';

function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="app-surface overflow-hidden p-4">
          <Skeleton.Image active className="!h-[320px] !w-full !rounded-[24px]" />
          <Skeleton active paragraph={{ rows: 3 }} title={{ width: '70%' }} className="mt-5" />
        </div>
      ))}
    </div>
  );
}

export default function HomePage() {
  const { data: products, isLoading, isError } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: () => productApi.getAll(),
  });

  const highlightedProducts = useMemo(() => products?.slice(0, 6) ?? [], [products]);
  const categories = useMemo(() => {
    const source = products ?? [];
    return Array.from(
      new Set(source.map((item) => item.category?.trim()).filter((value): value is string => Boolean(value))),
    ).slice(0, 4);
  }, [products]);

  return (
    <div className="animate-fade-in pb-20 pt-8 md:pt-10">
      <section className="app-shell">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="app-surface overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(17,17,17,0.08),_transparent_42%),linear-gradient(135deg,#fff_0%,#f7f7f7_100%)] px-6 py-8 md:px-10 md:py-12">
            <div className="max-w-2xl">
              <span className="app-status-pill">Sản phẩm mới • Theo dõi đơn hàng rõ ràng</span>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight text-[var(--color-primary)] md:text-6xl">
                Mua sắm nhanh, theo dõi đơn hàng dễ hơn.
              </h1>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/products" className="app-primary-btn">
                  Xem sản phẩm
                </Link>
                <Link href="/orders" className="app-secondary-btn">
                  Đơn hàng của tôi
                </Link>
              </div>
            </div>
          </div>

          <div className="app-surface px-6 py-6">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">
              Danh mục nổi bật
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {(categories.length > 0 ? categories : ['Nam', 'Nữ', 'Phụ kiện']).map((category) => (
                <Link
                  key={category}
                  href={`/products?category=${encodeURIComponent(category)}`}
                  className="rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-primary)] transition hover:border-[var(--color-primary)]"
                >
                  {category}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="app-shell mt-14">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <h2 className="app-section-title">Sản phẩm mới nhất</h2>
          <Link
            href="/products"
            className="text-sm font-semibold text-[var(--color-primary)] transition hover:opacity-70"
          >
            Xem toàn bộ
          </Link>
        </div>

        {isLoading ? (
          <ProductGridSkeleton />
        ) : isError ? (
          <div className="app-surface px-6 py-10">
            <Result
              status="500"
              title="Không thể tải danh sách sản phẩm"
              subTitle="Vui lòng thử lại sau."
            />
          </div>
        ) : highlightedProducts.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {highlightedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="app-surface px-6 py-14 text-center">
            <h3 className="text-xl font-semibold">Chưa có sản phẩm để hiển thị</h3>
          </div>
        )}
      </section>
    </div>
  );
}
