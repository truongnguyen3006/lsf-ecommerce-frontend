'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { App as AntdApp, Button, Card, Empty, Image, Popconfirm, Space, Table, Tag, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { productApi } from '@/services/productApi';
import { Product } from '@/types';

export default function AdminProductList() {
  const { message } = AntdApp.useApp();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const data = await productApi.getAll();
      setProducts(data);
    } catch (error) {
      console.error(error);
      message.error('Không tải được danh sách sản phẩm.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchProducts();
  }, [message]);

  const handleDelete = async (id: number) => {
    try {
      await productApi.delete(id);
      message.success('Đã xóa sản phẩm.');
      void fetchProducts();
    } catch (error) {
      console.error(error);
      message.error('Xóa sản phẩm thất bại.');
    }
  };

  const columns: ColumnsType<Product> = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 70,
      align: 'center',
    },
    {
      title: 'Ảnh',
      dataIndex: 'imageUrl',
      width: 90,
      render: (url?: string) => <Image src={url} width={56} height={56} style={{ objectFit: 'cover', borderRadius: 16 }} fallback="https://via.placeholder.com/56" />,
    },
    {
      title: 'Tên sản phẩm',
      dataIndex: 'name',
      render: (text: string, record) => (
        <div>
          <div className="font-semibold text-[var(--color-primary)]">{text}</div>
          <div className="mt-1 text-sm text-[var(--color-secondary)]">{record.category || 'Danh mục đang cập nhật'}</div>
        </div>
      ),
    },
    {
      title: 'Giá gốc',
      dataIndex: 'price',
      render: (price: number | undefined, record: Product) => {
        const displayPrice = price ?? record.basePrice ?? 0;
        return <span className="font-semibold">{displayPrice.toLocaleString('vi-VN')} đ</span>;
      },
    },
    {
      title: 'Biến thể',
      dataIndex: 'variants',
      render: (_, record: Product) => <Tag color={record.variants && record.variants.length > 0 ? 'blue' : 'default'}>{record.variants?.length || 0} biến thể</Tag>,
    },
    {
      title: 'Hành động',
      key: 'action',
      width: 150,
      render: (_, record: Product) => (
        <Space size="small">
          <Link href={`/admin/products/edit/${record.id}`}>
            <Tooltip title="Chỉnh sửa">
              <Button icon={<EditOutlined />} />
            </Tooltip>
          </Link>
          <Popconfirm
            title="Xóa sản phẩm này?"
            description="Tất cả biến thể con cũng sẽ bị xóa."
            onConfirm={() => handleDelete(record.id)}
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="Xóa">
              <Button danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="app-admin-card px-6 py-6 md:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">Sản phẩm</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Danh sách sản phẩm</h1>
            <p className="mt-3 text-sm leading-6 text-[var(--color-secondary)]">Xem nhanh danh mục, ảnh đại diện, giá và số lượng biến thể của từng sản phẩm.</p>
          </div>
          <Link href="/admin/products/create">
            <Button type="primary" icon={<PlusOutlined />} className="!bg-[var(--color-primary)] !shadow-none">
              Thêm sản phẩm mới
            </Button>
          </Link>
        </div>
      </div>

      <Card className="app-admin-card border-0">
        <Table
          columns={columns}
          dataSource={products}
          rowKey="id"
          loading={loading}
          locale={{ emptyText: <Empty description="Chưa có sản phẩm nào" /> }}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 860 }}
        />
      </Card>
    </div>
  );
}
