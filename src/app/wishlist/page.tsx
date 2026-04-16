import Link from 'next/link';
import { Empty } from 'antd';
import { HeartOutlined } from '@ant-design/icons';

export default function WishlistPage() {
  return (
    <div className="app-shell animate-fade-in py-8 md:py-10">
      <div className="app-surface px-6 py-12 md:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">Yêu thích</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Danh sách yêu thích</h1>
          <p className="mt-4 text-sm leading-7 text-[var(--color-secondary)] md:text-base">
            Danh sách yêu thích đã có giao diện cơ bản để bạn mở rộng tính năng sau này.
          </p>
        </div>

        <div className="mt-10 rounded-[28px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-6 py-10">
          <Empty image={<HeartOutlined className="text-6xl text-[var(--color-muted)]" />} description="Bạn chưa lưu sản phẩm nào">
            <Link href="/products" className="app-primary-btn">
              Khám phá sản phẩm
            </Link>
          </Empty>
        </div>
      </div>
    </div>
  );
}
