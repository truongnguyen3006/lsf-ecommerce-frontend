import Link from 'next/link';

const helpItems = [
  {
    title: 'Thanh toán và đơn hàng',
    description: 'Theo dõi tiến độ đơn hàng, kiểm tra trạng thái xử lý và các bước tiếp theo.',
  },
  {
    title: 'Tài khoản & hồ sơ',
    description: 'Quản lý thông tin cá nhân, đăng nhập và cập nhật hồ sơ người dùng.',
  },
  {
    title: 'Sản phẩm & tồn kho',
    description: 'Cách chọn màu, size, xem biến thể và tình trạng còn hàng.',
  },
];

export default function HelpPage() {
  return (
    <div className="app-shell animate-fade-in py-8 md:py-10">
      <div className="app-surface px-6 py-8 md:px-8 md:py-10">
        <div className="max-w-3xl">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">Trung tâm trợ giúp</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Hỗ trợ nhanh cho quá trình mua sắm</h1>
          <p className="mt-4 text-sm leading-7 text-[var(--color-secondary)] md:text-base">
            Khu vực này tập trung những nội dung khách hàng thường tìm nhất khi mua sắm online: đặt hàng, thanh toán, theo dõi đơn và cập nhật tài khoản.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {helpItems.map((item) => (
            <div key={item.title} className="rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-5">
              <h2 className="text-lg font-semibold">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--color-secondary)]">{item.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/products" className="app-primary-btn">
            Xem sản phẩm
          </Link>
          <Link href="/orders" className="app-secondary-btn">
            Theo dõi đơn hàng
          </Link>
        </div>
      </div>
    </div>
  );
}
