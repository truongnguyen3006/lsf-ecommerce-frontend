'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { App as AntdApp } from 'antd';
import { FacebookFilled, InstagramFilled, TwitterSquareFilled, YoutubeFilled } from '@ant-design/icons';

const footerGroups = [
  {
    title: 'Mua sắm',
    links: [
      { href: '/products', label: 'Tất cả sản phẩm' },
      { href: '/products?category=Nam', label: 'Nam' },
      { href: '/products?category=Nữ', label: 'Nữ' },
      { href: '/products?category=Trẻ', label: 'Trẻ em' },
    ],
  },
  {
    title: 'Hỗ trợ',
    links: [
      { href: '/help', label: 'Trung tâm trợ giúp' },
      { href: '/checkout', label: 'Thanh toán' },
      { href: '/orders', label: 'Theo dõi đơn hàng' },
      { href: '/profile', label: 'Tài khoản của tôi' },
    ],
  },
  {
    title: 'Khám phá',
    links: [
      { href: '/wishlist', label: 'Yêu thích' },
      { href: '/about', label: 'Về Flash Store' },
      { href: '/products?featured=sale', label: 'Ưu đãi mới' },
      { href: '/help', label: 'Chính sách & điều khoản' },
    ],
  },
];

export default function Footer() {
  const pathname = usePathname();
  const { message } = AntdApp.useApp();

  if (pathname.startsWith('/admin') || pathname === '/login' || pathname === '/register') {
    return null;
  }

  return (
    <footer className="mt-14 border-t border-[var(--color-border)] bg-[#111111] text-white">
      <div className="app-shell py-14">
        <div className="grid gap-10 lg:grid-cols-[1.25fr_1fr_1fr_1fr]">
          <div className="space-y-5">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.28em] text-white/60">Flash Store</div>
              <h2 className="mt-3 max-w-sm text-3xl font-semibold tracking-tight">Mua sắm tinh gọn, dễ theo dõi và tập trung vào trải nghiệm.</h2>
            </div>
            <p className="max-w-md text-sm leading-7 text-white/70">
              Từ khám phá sản phẩm, thêm vào giỏ đến theo dõi đơn hàng, mọi màn hình đều được giữ nhịp đơn giản để người dùng thao tác nhanh hơn.
            </p>
            <div className="flex items-center gap-3">
              {[FacebookFilled, InstagramFilled, TwitterSquareFilled, YoutubeFilled].map((Icon, index) => (
                <button
                  key={index}
                  type="button"
                  aria-label="Liên kết mạng xã hội"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/5 text-lg text-white/80 transition hover:border-white/30 hover:bg-white/10 hover:text-white"
                  onClick={() => message.info('Liên kết mạng xã hội sẽ được cập nhật sau.')}
                >
                  <Icon />
                </button>
              ))}
            </div>
          </div>

          {footerGroups.map((group) => (
            <div key={group.title}>
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/90">{group.title}</h3>
              <ul className="mt-4 space-y-3 text-sm text-white/65">
                {group.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link href={link.href} className="transition hover:text-white">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-white/55 md:flex-row md:items-center md:justify-between">
          <div>© 2026 Flash Store. All rights reserved.</div>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/help" className="transition hover:text-white">
              Điều khoản sử dụng
            </Link>
            <Link href="/help" className="transition hover:text-white">
              Chính sách bảo mật
            </Link>
            <Link href="/help" className="transition hover:text-white">
              Chính sách giao hàng
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
