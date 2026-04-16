import '@ant-design/v5-patch-for-react-19';
import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/lib/providers';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import RouteAccessGuard from '@/components/RouteAccessGuard';

export const metadata: Metadata = {
  title: 'Flash Store',
  description: 'Giao diện mua sắm hiện đại cho hệ thống ecommerce',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="min-h-screen bg-[var(--color-surface-elevated)] text-[var(--color-primary)]">
        <Providers>
          <RouteAccessGuard>
            <div className="flex min-h-screen flex-col">
              <Header />
              <main className="flex-1">{children}</main>
              <Footer />
            </div>
          </RouteAccessGuard>
        </Providers>
      </body>
    </html>
  );
}
