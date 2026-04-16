'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  LeftOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { Result, Skeleton, Spin, message } from 'antd';
import { productApi } from '@/services/productApi';
import { inventoryApi } from '@/services/inventoryApi';
import { useCartStore } from '@/store/useCartStore';
import { CartItem, Product, ProductVariant } from '@/types';
import QuantityStepper from '@/components/ui/QuantityStepper';

const FALLBACK_IMAGE = 'https://via.placeholder.com/800x800?text=Product';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(value);
}

export default function ProductDetailPage() {
  const params = useParams();
  const productId = params.id as string;

  return <ProductDetailContent key={productId} productId={productId} />;
}

function ProductDetailContent({ productId }: { productId: string }) {
  const addToCart = useCartStore((state) => state.addToCart);

  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [buyQuantity, setBuyQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const { data: product, isLoading, isError } = useQuery<Product>({
    queryKey: ['product', productId],
    queryFn: () => productApi.getById(productId),
  });

  const activeVariants = useMemo(
    () =>
      (product?.variants ?? []).filter(
        (variant) => (variant as ProductVariant & { isActive?: boolean }).isActive !== false,
      ),
    [product?.variants],
  );

  const effectiveSelectedColor = selectedColor ?? activeVariants[0]?.color ?? null;

  const colorVariants = useMemo(() => {
    const unique = new Map<string, ProductVariant>();
    activeVariants.forEach((variant) => {
      if (!unique.has(variant.color)) unique.set(variant.color, variant);
    });
    return Array.from(unique.values());
  }, [activeVariants]);

  const selectedColorVariants = useMemo(
    () => activeVariants.filter((variant) => variant.color === effectiveSelectedColor),
    [activeVariants, effectiveSelectedColor],
  );

  const sizeStocks = useQueries({
    queries: selectedColorVariants.map((variant) => ({
      queryKey: ['inventory-availability-by-size', variant.skuCode],
      queryFn: () => inventoryApi.getAvailability(variant.skuCode),
      staleTime: 30_000,
    })),
  });

  const sizeOptions = useMemo(
    () =>
      selectedColorVariants.map((variant, index) => ({
        variant,
        stock: sizeStocks[index]?.data?.availableStock,
        isLoading: sizeStocks[index]?.isLoading ?? false,
      })),
    [selectedColorVariants, sizeStocks],
  );

  const currentVariant = useMemo(
    () =>
      activeVariants.find(
        (variant) =>
          variant.color === effectiveSelectedColor && variant.size === selectedSize,
      ) ?? null,
    [activeVariants, effectiveSelectedColor, selectedSize],
  );

  const { data: currentInventory, isLoading: isLoadingInventory } = useQuery({
    queryKey: ['inventory-availability-selected', currentVariant?.skuCode],
    queryFn: () => inventoryApi.getAvailability(currentVariant!.skuCode),
    enabled: Boolean(currentVariant?.skuCode),
    staleTime: 30_000,
  });

  const galleryImages = useMemo(() => {
    const representativeVariant =
      currentVariant ||
      activeVariants.find((variant) => variant.color === effectiveSelectedColor) ||
      activeVariants[0];

    const sources = [
      ...(representativeVariant?.galleryImages ?? []),
      representativeVariant?.imageUrl,
      ...(product?.galleryImages ?? []),
      product?.imageUrl,
    ].filter((image): image is string => Boolean(image));

    return Array.from(new Set(sources.length > 0 ? sources : [FALLBACK_IMAGE]));
  }, [
    activeVariants,
    currentVariant,
    product?.galleryImages,
    product?.imageUrl,
    effectiveSelectedColor,
  ]);

  const safeImageIndex = Math.min(
    currentImageIndex,
    Math.max(galleryImages.length - 1, 0),
  );

  const displayPrice = currentVariant?.price ?? product?.price ?? product?.basePrice ?? 0;
  const stock = currentInventory?.availableStock  ?? 0;
  const isOutOfStock = currentVariant ? stock <= 0 : false;
  const currentImage =
    galleryImages[safeImageIndex] || galleryImages[0] || FALLBACK_IMAGE;

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % galleryImages.length);
  };

  const previousImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length);
  };

  const handleAddToCart = () => {
    if (!product) return;
    if (!selectedSize || !currentVariant) {
      message.warning('Vui lòng chọn màu và size trước khi thêm vào giỏ hàng.');
      return;
    }
    if (isOutOfStock) {
      message.error('Biến thể này hiện đã hết hàng.');
      return;
    }

    const itemToAdd: CartItem = {
      id: product.id,
      skuCode: currentVariant.skuCode,
      name: product.name,
      price: currentVariant.price,
      imageUrl: currentVariant.imageUrl || product.imageUrl || FALLBACK_IMAGE,
      quantity: buyQuantity,
      category: product.category,
      selectedColor: currentVariant.color,
      selectedSize: currentVariant.size,
    };

    addToCart(itemToAdd, buyQuantity);
    message.success(`Đã thêm ${buyQuantity} sản phẩm vào giỏ hàng.`);
  };

  if (isLoading) {
    return (
      <div className="app-shell py-8 md:py-10">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="app-surface p-6">
            <Skeleton.Image active className="!h-[520px] !w-full !rounded-[24px]" />
          </div>
          <div className="app-surface p-6">
            <Skeleton active paragraph={{ rows: 10 }} />
          </div>
        </div>
      </div>
    );
  }

  if (
    isError ||
    !product ||
    (product.variants && product.variants.length > 0 && activeVariants.length === 0)
  ) {
    return (
      <div className="app-shell py-10">
        <div className="app-surface px-6 py-10">
          <Result
            status="404"
            title="Sản phẩm hiện chưa sẵn sàng"
            subTitle="Biến thể đang tạm ngừng kinh doanh hoặc chưa có đủ dữ liệu hiển thị."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell animate-fade-in py-8 md:py-10">
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="app-surface overflow-hidden p-4 md:p-6">
          <div className="grid gap-4 lg:grid-cols-[88px_minmax(0,1fr)]">
            <div className="no-scrollbar hidden max-h-[700px] flex-col gap-3 overflow-y-auto lg:flex">
              {galleryImages.map((image, index) => (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  aria-label={`Chọn ảnh ${index + 1}`}
                  onClick={() => setCurrentImageIndex(index)}
                  className={`overflow-hidden rounded-[22px] border p-1 transition ${
                    safeImageIndex === index
                      ? 'border-[var(--color-primary)] bg-white'
                      : 'border-transparent bg-[var(--color-surface-muted)] hover:border-[var(--color-border-strong)]'
                  }`}
                >
                  <img
                    src={image}
                    alt={`Thumbnail ${index + 1}`}
                    className="h-20 w-full rounded-[18px] object-cover"
                  />
                </button>
              ))}
            </div>

            <div className="relative flex min-h-[420px] items-center justify-center overflow-hidden rounded-[28px] bg-[var(--color-surface-muted)] md:min-h-[620px]">
              {galleryImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={previousImage}
                    className="app-icon-button absolute left-4 top-1/2 z-10 -translate-y-1/2"
                    aria-label="Ảnh trước"
                  >
                    <LeftOutlined />
                  </button>
                  <button
                    type="button"
                    onClick={nextImage}
                    className="app-icon-button absolute right-4 top-1/2 z-10 -translate-y-1/2"
                    aria-label="Ảnh tiếp theo"
                  >
                    <RightOutlined />
                  </button>
                </>
              )}
              <img
                src={currentImage}
                alt={product.name}
                className="h-full max-h-[640px] w-full object-contain p-6 transition duration-500 hover:scale-[1.02]"
              />
            </div>
          </div>
        </section>

        <section className="app-surface p-6 md:p-8 xl:sticky xl:top-24 xl:h-fit">
          <div className="flex flex-wrap gap-2">
            <span className="app-status-pill">{product.category || 'Danh mục đang cập nhật'}</span>
            <span className="app-status-pill">
              SKU biến thể: {currentVariant?.skuCode || 'Chưa chọn'}
            </span>
          </div>

          <div className="mt-5">
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{product.name}</h1>
            <div className="mt-3 text-2xl font-semibold text-[var(--color-primary)]">
              {formatCurrency(displayPrice)}
            </div>
            <p className="mt-4 text-sm leading-7 text-[var(--color-secondary)] md:text-base">
              {product.description?.trim() ||
                'Sản phẩm phù hợp cho nhu cầu sử dụng hằng ngày với thiết kế gọn gàng và dễ phối.'}
            </p>
          </div>

          <div className="mt-8 space-y-6">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
                  Màu sắc
                </span>
                <span className="text-sm font-medium text-[var(--color-primary)]">
                  {effectiveSelectedColor || 'Chưa chọn'}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
                {colorVariants.map((variant) => (
                  <button
                    key={variant.skuCode}
                    type="button"
                    onClick={() => {
                      setSelectedColor(variant.color);
                      setSelectedSize(null);
                      setBuyQuantity(1);
                      setCurrentImageIndex(0);
                    }}
                    className={`overflow-hidden rounded-[22px] border p-1 transition ${
                      effectiveSelectedColor === variant.color
                        ? 'border-[var(--color-primary)] bg-white shadow-[var(--shadow-soft)]'
                        : 'border-[var(--color-border)] bg-[var(--color-surface-muted)] hover:border-[var(--color-border-strong)]'
                    }`}
                  >
                    <img
                      src={variant.imageUrl || product.imageUrl || FALLBACK_IMAGE}
                      alt={variant.color}
                      className="aspect-square w-full rounded-[18px] object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
                  Kích cỡ
                </span>
                <span className="text-sm text-[var(--color-secondary)]">
                  Chọn size để xem tồn kho chính xác
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {sizeOptions.map(({ variant, stock: optionStock, isLoading: isLoadingSize }) => {
                  const unavailable = typeof optionStock === 'number' && optionStock <= 0;
                  const isActive = selectedSize === variant.size;

                  return (
                    <button
                      key={variant.skuCode}
                      type="button"
                      onClick={() => setSelectedSize(variant.size)}
                      disabled={unavailable}
                      className={`rounded-[20px] border px-4 py-4 text-left transition ${
                        isActive
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                          : 'border-[var(--color-border)] bg-white text-[var(--color-primary)] hover:border-[var(--color-primary)]'
                      } ${unavailable ? 'cursor-not-allowed opacity-45' : ''}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-base font-semibold">{variant.size}</span>
                        {isLoadingSize ? <Spin size="small" /> : null}
                      </div>
                      <div
                        className={`mt-1 text-xs ${
                          isActive ? 'text-white/80' : 'text-[var(--color-secondary)]'
                        }`}
                      >
                        {typeof optionStock === 'number'
                          ? optionStock > 0
                            ? `Còn ${optionStock} sản phẩm khả dụng`
                            : 'Hết hàng'
                          : 'Đang tải tồn kho'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
                    Trạng thái
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-sm font-medium">
                    {currentVariant ? (
                      isLoadingInventory ? (
                        <>
                          <Spin size="small" />
                          <span>Đang kiểm tra tồn kho…</span>
                        </>
                      ) : isOutOfStock ? (
                        <>
                          <CloseCircleOutlined className="text-[var(--color-danger)]" />
                          <span>Biến thể này đã hết hàng</span>
                        </>
                      ) : (
                        <>
                          <CheckCircleOutlined className="text-[var(--color-success)]" />
                          <span>Còn {stock} sản phẩm có thể đặt</span>
                        </>
                      )
                    ) : (
                      <span>Hãy chọn size để xem tồn kho chính xác.</span>
                    )}
                  </div>
                </div>
                <QuantityStepper
                  value={buyQuantity}
                  min={1}
                  max={currentVariant && stock > 0 ? stock : undefined}
                  onChange={setBuyQuantity}
                  disabled={!currentVariant || isOutOfStock}
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleAddToCart}
                className="app-primary-btn flex-1 py-4 text-base"
                disabled={!currentVariant || isOutOfStock}
              >
                {!currentVariant
                  ? 'Chọn size trước khi thêm giỏ'
                  : isOutOfStock
                    ? 'Hết hàng'
                    : 'Thêm vào giỏ hàng'}
              </button>
              <button
                type="button"
                onClick={() => message.info('Tính năng yêu thích sẽ sớm được cập nhật.')}
                className="app-secondary-btn flex-1 py-4 text-base"
              >
                Lưu sản phẩm
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}