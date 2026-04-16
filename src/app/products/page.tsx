'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Empty, Input, Select, Skeleton } from 'antd';
import ProductCard from '@/components/ProductCard';
import { productApi } from '@/services/productApi';
import { Product } from '@/types';

export default function ProductsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get('category') || 'Tất cả';
  const initialKeyword = searchParams.get('q') || '';

  const [keyword, setKeyword] = useState(initialKeyword);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);

  useEffect(() => {
    setKeyword(initialKeyword);
  }, [initialKeyword]);

  useEffect(() => {
    setSelectedCategory(initialCategory);
  }, [initialCategory]);

  useEffect(() => {
    const currentKeyword = searchParams.get('q') || '';
    const currentCategory = searchParams.get('category') || 'Tất cả';

    if (keyword === currentKeyword && selectedCategory === currentCategory) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    const trimmedKeyword = keyword.trim();

    if (trimmedKeyword) {
      params.set('q', trimmedKeyword);
    } else {
      params.delete('q');
    }

    if (selectedCategory !== 'Tất cả') {
      params.set('category', selectedCategory);
    } else {
      params.delete('category');
    }

    const nextQuery = params.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }, [keyword, selectedCategory, pathname, router, searchParams]);

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ['products-catalog'],
    queryFn: () => productApi.getAll(),
  });

  const categories = useMemo(() => {
    const values = Array.from(
      new Set(
        (products ?? [])
          .map((item) => item.category?.trim())
          .filter(Boolean),
      ),
    ) as string[];

    return ['Tất cả', ...values];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return (products ?? []).filter((product) => {
      const matchesCategory =
        selectedCategory === 'Tất cả' ||
        product.category?.toLowerCase().includes(selectedCategory.toLowerCase());

      const matchesKeyword =
        !normalizedKeyword ||
        product.name.toLowerCase().includes(normalizedKeyword) ||
        product.description?.toLowerCase().includes(normalizedKeyword) ||
        product.category?.toLowerCase().includes(normalizedKeyword);

      return matchesCategory && matchesKeyword;
    });
  }, [keyword, products, selectedCategory]);

  return (
    <div className="app-shell animate-fade-in py-8 md:py-10">
      <div className="app-surface px-6 py-8 md:px-8 md:py-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">
              Danh mục sản phẩm
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
              Tất cả sản phẩm
            </h1>
          </div>

          <div className="flex flex-col gap-3 md:w-[420px] md:flex-row">
            <Input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Tìm sản phẩm"
              allowClear
            />
            <Select
              value={selectedCategory}
              onChange={setSelectedCategory}
              options={categories.map((item) => ({ label: item, value: item }))}
            />
          </div>
        </div>
      </div>

      <div className="mt-8">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="app-surface p-4">
                <Skeleton.Image active className="!h-[320px] !w-full !rounded-[24px]" />
                <Skeleton active paragraph={{ rows: 3 }} className="mt-4" />
              </div>
            ))}
          </div>
        ) : filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="app-surface px-6 py-14">
            <Empty description="Không tìm thấy sản phẩm phù hợp" />
          </div>
        )}
      </div>
    </div>
  );
}
