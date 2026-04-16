'use client';

import Link from 'next/link';
import { App as AntdApp, Avatar, Badge, Dropdown, type MenuProps } from 'antd';
import {
  HeartOutlined,
  LogoutOutlined,
  MenuOutlined,
  SearchOutlined,
  ShoppingCartOutlined,
  ThunderboltFilled,
  UserOutlined,
} from '@ant-design/icons';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCartStore } from '@/store/useCartStore';
import { useAuthStore } from '@/store/useAuthStore';
import { hasAdminRole } from '@/lib/auth';

const navigationLinks = [
  { href: '/products', label: 'Tất cả' },
  { href: '/products?category=Nam', label: 'Nam' },
  { href: '/products?category=Nữ', label: 'Nữ' },
  { href: '/products?category=Trẻ', label: 'Trẻ em' },
  { href: '/products?featured=sale', label: 'Ưu đãi' },
];

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const items = useCartStore((state) => state.items);
  const { user, isAuthenticated, logout } = useAuthStore();
  const { message } = AntdApp.useApp();

  const shouldHideHeader = pathname.startsWith('/admin') || pathname === '/login' || pathname === '/register';
  const cartCount = items.reduce((total, item) => total + item.quantity, 0);

  if (shouldHideHeader) {
    return null;
  }

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const handleCartClick = () => {
    if (!isAuthenticated) {
      message.warning('Vui lòng đăng nhập để xem giỏ hàng.');
      router.push('/login');
      return;
    }
    router.push('/checkout');
  };

  const userMenu: MenuProps['items'] = [
    {
      key: 'user-info',
      label: (
        <div className="cursor-default px-1 py-1">
          <div className="text-sm font-semibold text-[var(--color-primary)]">{user?.fullName || user?.username || 'Khách hàng'}</div>
          <div className="text-xs text-[var(--color-secondary)]">{user?.email || 'Tài khoản thành viên'}</div>
        </div>
      ),
      disabled: true,
    },
    { type: 'divider' },
    {
      key: 'profile',
      label: <Link href="/profile">Hồ sơ cá nhân</Link>,
      icon: <UserOutlined />,
    },
    {
      key: 'orders',
      label: <Link href="/orders">Đơn hàng của tôi</Link>,
      icon: <ShoppingCartOutlined />,
    },
    ...(hasAdminRole(user?.roles)
      ? [
          {
            key: 'admin',
            label: <Link href="/admin">Quản trị hệ thống</Link>,
            icon: <MenuOutlined />,
          },
        ]
      : []),
    {
      key: 'logout',
      label: 'Đăng xuất',
      icon: <LogoutOutlined />,
      danger: true,
      onClick: handleLogout,
    },
  ];

  return (
    <div className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-white/90 backdrop-blur-xl">
      <div className="hidden border-b border-[var(--color-border)] bg-[var(--color-surface-muted)] md:block">
        <div className="app-shell flex h-10 items-center justify-between text-xs font-medium text-[var(--color-secondary)]">
          <div className="flex items-center gap-4">
            {!isAuthenticated && (
              <Link href="/register" className="hover:text-[var(--color-primary)]">
                Trở thành thành viên
              </Link>
            )}
            <Link href="/help" className="hover:text-[var(--color-primary)]">
              Trợ giúp
            </Link>
            <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-[var(--color-primary)]">
              Miễn phí vận chuyển cho đơn từ 500.000đ
            </span>
          </div>
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <span>Xin chào, {user?.fullName || user?.username || 'bạn'}.</span>
            ) : (
              <>
                <Link href="/login" className="hover:text-[var(--color-primary)]">
                  Đăng nhập
                </Link>
                <Link href="/register" className="hover:text-[var(--color-primary)]">
                  Đăng ký
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      <header className="app-shell grid h-18 grid-cols-[auto_1fr_auto] items-center gap-3 py-3 md:h-20 md:gap-8">
        <Link href="/" className="flex items-center gap-2 self-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-primary)] text-white shadow-[var(--shadow-soft)]">
            <ThunderboltFilled className="text-xl" />
          </span>
          <div className="leading-tight">
            <div className="text-lg font-black uppercase tracking-[0.22em] md:text-xl">Flash</div>
            <div className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--color-secondary)]">Store</div>
          </div>
        </Link>

        <div className="flex items-center justify-center">
          <nav className="hidden items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-2 shadow-[var(--shadow-soft)] lg:flex">
            {navigationLinks.map((item) => {
              const activeCategory = new URLSearchParams(item.href.split('?')[1] ?? '').get('category');
              const currentCategory = searchParams.get('category');
              const featuredValue = new URLSearchParams(item.href.split('?')[1] ?? '').get('featured');
              const currentFeatured = searchParams.get('featured');
              const isActive =
                item.href === '/products'
                  ? pathname === '/products' && !currentCategory && !currentFeatured
                  : pathname.startsWith('/products') && ((activeCategory && activeCategory === currentCategory) || (featuredValue && featuredValue === currentFeatured));

              return (
                <Link
                  key={item.href + item.label}
                  href={item.href}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    isActive ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-primary)] hover:bg-[var(--color-surface-muted)]'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="no-scrollbar flex w-full items-center gap-2 overflow-x-auto pb-1 lg:hidden">
            {navigationLinks.map((item) => (
              <Link
                key={item.href + item.label}
                href={item.href}
                className="whitespace-nowrap rounded-full border border-[var(--color-border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--color-primary)]"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 md:gap-3">
          <Link href="/products" aria-label="Tìm sản phẩm" className="app-icon-button hidden md:inline-flex">
            <SearchOutlined className="text-lg" />
          </Link>
          <Link href="/wishlist" aria-label="Danh sách yêu thích" className="app-icon-button hidden md:inline-flex">
            <HeartOutlined className="text-lg" />
          </Link>
          <button type="button" aria-label="Mở giỏ hàng" onClick={handleCartClick} className="app-icon-button relative">
            <Badge count={cartCount} size="small" offset={[-1, 1]}>
              <ShoppingCartOutlined className="text-xl" />
            </Badge>
          </button>

          {isAuthenticated && user ? (
            <Dropdown menu={{ items: userMenu }} trigger={['click']} placement="bottomRight" arrow>
              <button
                type="button"
                aria-label="Mở menu tài khoản"
                className="ml-1 inline-flex items-center justify-center rounded-full border border-[var(--color-border)] bg-white p-1 shadow-[var(--shadow-soft)] transition hover:border-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
              >
                <Avatar className="bg-[var(--color-primary)] text-white" size={40}>
                  {(user.fullName || user.username || 'U').charAt(0).toUpperCase()}
                </Avatar>
              </button>
            </Dropdown>
          ) : (
            <Link href="/login" className="app-primary-btn px-4 py-2 text-xs md:text-sm">
              Đăng nhập
            </Link>
          )}

          <button type="button" className="app-icon-button lg:hidden" aria-label="Mở danh mục" onClick={() => router.push('/products')}>
            <MenuOutlined className="text-lg" />
          </button>
        </div>
      </header>
    </div>
  );
}
