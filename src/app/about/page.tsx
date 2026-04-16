import Link from 'next/link';

const pillars = [
  {
    title: 'Khám phá nhanh',
    description: 'Danh mục rõ ràng, dễ lọc theo đối tượng và nhu cầu mua sắm.',
  },
  {
    title: 'Thanh toán gọn',
    description: 'Tổng tiền, số lượng và thông tin đơn hàng luôn hiển thị minh bạch.',
  },
  {
    title: 'Theo dõi dễ',
    description: 'Trạng thái đơn hàng được trình bày theo dạng tiến độ để khách dễ nắm bắt.',
  },
];

export default function AboutPage() {
  return (
    <div className="app-shell animate-fade-in py-8 md:py-10">
      <section className="app-surface overflow-hidden px-6 py-8 md:px-8 md:py-10">
        <div className="max-w-3xl">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">Về Flash Store</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Một giao diện thương mại điện tử tập trung vào trải nghiệm mua hàng.</h1>
          <p className="mt-4 text-sm leading-7 text-[var(--color-secondary)] md:text-base">
            Flash Store được tinh chỉnh theo hướng đơn giản, hiện đại và ưu tiên những điểm chạm quan trọng nhất trong hành trình mua sắm online.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {pillars.map((pillar) => (
            <div key={pillar.title} className="rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-5">
              <h2 className="text-lg font-semibold">{pillar.title}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--color-secondary)]">{pillar.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/products" className="app-primary-btn">
            Xem sản phẩm
          </Link>
          <Link href="/help" className="app-secondary-btn">
            Xem trợ giúp
          </Link>
        </div>
      </section>
    </div>
  );
}
