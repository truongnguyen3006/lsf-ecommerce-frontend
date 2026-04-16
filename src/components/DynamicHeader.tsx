'use client'; 

import dynamic from 'next/dynamic';

const Header = dynamic(() => import('@/components/Header'), { 
  ssr: false,
  // Lưu ý: Loading state này có thể hiện ra 1 tích tắc ở Admin
  // Nếu bạn thấy khó chịu, hãy xóa dòng loading đi hoặc để null
  loading: () => <div className="h-20 bg-white/50 w-full animate-pulse" /> 
});

export default function DynamicHeader() {
  return <Header />;
}