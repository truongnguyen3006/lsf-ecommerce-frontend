'use client'; 
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';

// Import Footer thật (giả sử bạn đã có file src/components/Footer.tsx)
const Footer = dynamic(() => import('@/components/Footer'), { ssr: true });

export default function DynamicFooter() {
  const pathname = usePathname();
  
  // Ẩn Footer ở trang admin hoặc login/register nếu muốn
  if (pathname.startsWith('/admin') || pathname === '/login' || pathname === '/register') {
      return null;
  }

  return <Footer />;
}