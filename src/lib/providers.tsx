'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { App as AntdApp, ConfigProvider, theme } from 'antd';
import '@ant-design/v5-patch-for-react-19';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AntdRegistry>
        <ConfigProvider
          theme={{
            algorithm: theme.defaultAlgorithm,
            token: {
              colorPrimary: '#111111',
              colorText: '#111111',
              colorTextSecondary: '#5f5f5f',
              colorBorder: '#e7e7e7',
              colorBgLayout: '#f7f7f7',
              colorBgContainer: '#ffffff',
              borderRadius: 18,
              borderRadiusLG: 24,
              boxShadowTertiary: '0 8px 30px rgba(17,17,17,0.06)',
              fontFamily: 'Inter, Helvetica Neue, Helvetica, Arial, sans-serif',
            },
            components: {
              Button: {
                borderRadius: 999,
                controlHeight: 44,
              },
              Input: {
                borderRadius: 16,
                controlHeight: 48,
              },
              InputNumber: {
                borderRadius: 16,
                controlHeight: 48,
              },
              Card: {
                borderRadiusLG: 24,
                boxShadowTertiary: '0 8px 30px rgba(17,17,17,0.06)',
              },
              Layout: {
                bodyBg: '#f7f7f7',
                headerBg: '#ffffff',
                siderBg: '#ffffff',
              },
              Menu: {
                itemBorderRadius: 14,
                itemSelectedBg: '#111111',
                itemSelectedColor: '#ffffff',
                itemHoverColor: '#111111',
              },
              Steps: {
                colorPrimary: '#111111',
              },
            },
          }}
        >
          <AntdApp>{children}</AntdApp>
        </ConfigProvider>
      </AntdRegistry>
    </QueryClientProvider>
  );
}
