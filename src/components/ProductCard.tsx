import Link from 'next/link';
import { Product } from '@/types';

interface ProductCardProps {
  product: Product;
  priority?: boolean;
}

const FALLBACK_IMAGE =
  'https://static.nike.com/a/images/c_limit,w_592,f_auto/t_product_v1/u_126ab356-44d8-4a06-89b4-fcdcc8df0245/air-jordan-1-low-mens-shoes-0LXhbn.png';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(value);
}

export default function ProductCard({ product }: ProductCardProps) {
  const price = product.price ?? product.basePrice ?? 0;
  const categoryLabel = product.category?.trim() || 'Sản phẩm nổi bật';

  return (
    <Link
      href={`/product/${product.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-[28px] border border-[var(--color-border)] bg-white shadow-[var(--shadow-soft)] transition duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
    >
      <div className="relative aspect-[4/4.5] overflow-hidden bg-[var(--color-surface-muted)]">
        <div className="absolute left-4 top-4 z-10 inline-flex rounded-full border border-black/5 bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-primary)] backdrop-blur-sm">
          New drop
        </div>
        <img src={product.imageUrl || FALLBACK_IMAGE} alt={product.name} className="h-full w-full object-contain p-6 transition duration-500 group-hover:scale-[1.03]" />
      </div>

      <div className="flex flex-1 flex-col gap-3 px-5 py-5 md:px-6">
        <div className="space-y-1.5">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">{categoryLabel}</div>
          <h3 className="line-clamp-2 text-lg font-semibold tracking-tight text-[var(--color-primary)]">{product.name}</h3>
          <p className="line-clamp-2 text-sm leading-6 text-[var(--color-secondary)]">
            {product.description?.trim() || 'Thiết kế linh hoạt, dễ phối và phù hợp sử dụng hằng ngày.'}
          </p>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 pt-2">
          <span className="text-base font-semibold text-[var(--color-primary)]">{formatCurrency(price)}</span>
          <span className="inline-flex items-center rounded-full border border-[var(--color-border)] px-3 py-1 text-xs font-medium text-[var(--color-primary)] transition group-hover:border-[var(--color-primary)]">
            Xem chi tiết
          </span>
        </div>
      </div>
    </Link>
  );
}
