'use client';

import { useState } from 'react';
import {
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ArrowLeftOutlined,
  BarcodeOutlined,
  CloudUploadOutlined,
  DeleteOutlined,
  DollarOutlined,
  FileImageOutlined,
  InboxOutlined,
  RobotOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { productApi } from '@/services/productApi';
import type { CreateProductRequest, CreateVariantRequest } from '@/types';

interface FormListField {
  key: number;
  name: number;
  fieldKey?: number;
}

const { TextArea } = Input;
const { Title, Text } = Typography;

function formatCurrency(value?: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(value ?? 0);
}

export default function CreateProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();

  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [genModelCode, setGenModelCode] = useState('');
  const [genColor, setGenColor] = useState('');
  const [genSizes, setGenSizes] = useState<string[]>([]);
  const [genPrice, setGenPrice] = useState<number | null>(null);
  const [genImage, setGenImage] = useState('');
  const [genGallery, setGenGallery] = useState<string[]>(['', '', '', '']);

  const watchedName = Form.useWatch('name', form) as string | undefined;
  const watchedCategory = Form.useWatch('category', form) as string | undefined;
  const watchedBasePrice = Form.useWatch('basePrice', form) as number | undefined;
  const watchedVariants = (Form.useWatch('variants', form) as CreateVariantRequest[] | undefined) || [];

  const handleFinish = async (values: CreateProductRequest) => {
    const formVariants = form.getFieldValue('variants') as CreateVariantRequest[] | undefined;

    if (!formVariants || formVariants.length === 0) {
      messageApi.error('Cần ít nhất 1 biến thể sản phẩm');
      return;
    }

    setLoading(true);

    try {
      let mainImage = values.imageUrl;
      const mainGallery = values.galleryImages || [];

      if (!mainImage && formVariants[0]?.imageUrl) {
        mainImage = formVariants[0].imageUrl;
      }

      const payload: CreateProductRequest = {
        ...values,
        imageUrl: mainImage,
        galleryImages: mainGallery,
        variants: formVariants.map((variant) => ({
          ...variant,
          initialQuantity: variant.initialQuantity || 0,
          price: variant.price || values.basePrice,
          galleryImages: variant.galleryImages || [],
        })),
      };

      await productApi.create(payload);
      messageApi.success('Tạo sản phẩm thành công');
      router.push('/admin/products');
    } catch (error: unknown) {
      console.error(error);
      messageApi.error('Lỗi khi tạo sản phẩm');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkGenerate = () => {
    if (!genModelCode || !genColor || genSizes.length === 0) {
      messageApi.warning('Vui lòng nhập mã dòng SP, tên màu và chọn size');
      return;
    }

    const validGallery = genGallery.filter((url) => url.trim() !== '');
    const currentVariants = (form.getFieldValue('variants') as CreateVariantRequest[]) || [];

    const newVariants: CreateVariantRequest[] = genSizes.map((size) => ({
      skuCode: `${genModelCode.toUpperCase().trim()}-${genColor.toUpperCase().trim()}-${size}`,
      color: genColor,
      size,
      initialQuantity: 100,
      price: genPrice ?? 0,
      imageUrl: genImage,
      galleryImages: validGallery,
    }));

    form.setFieldsValue({
      variants: [...currentVariants, ...newVariants],
    });

    setIsGeneratorOpen(false);
    setGenColor('');
    setGenSizes([]);
    setGenImage('');
    setGenGallery(['', '', '', '']);
    messageApi.success(`Đã thêm ${genSizes.length} biến thể màu ${genColor}`);
  };

  const updateGenGallery = (index: number, value: string) => {
    const nextGallery = [...genGallery];
    nextGallery[index] = value;
    setGenGallery(nextGallery);
  };

  return (
    <div className="mx-auto max-w-[1480px] px-4 pb-28 pt-6 md:px-6 xl:px-8">
      {contextHolder}

      <section className="mb-6 overflow-hidden rounded-[32px] border border-black/5 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-6 p-6 md:p-8 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <Link
              href="/admin/products"
              className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-black"
            >
              <ArrowLeftOutlined />
              Quay lại danh sách
            </Link>

            <div className="mt-4">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-400">
                Sản phẩm mới
              </div>
              <Title level={1} className="!mb-2 !mt-2 !text-[34px] !font-semibold !tracking-tight">
                Tạo sản phẩm
              </Title>
              <Text className="max-w-3xl text-base leading-7 text-gray-500">
                Xây dựng nhanh một sản phẩm mới với bố cục rõ ràng, bulk add biến thể
                và vùng preview để kiểm tra thông tin trước khi lưu.
              </Text>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Tag className="rounded-full border-0 bg-gray-100 px-3 py-1.5 text-gray-700">
                {watchedCategory || 'Giày Nam'}
              </Tag>
              <Tag className="rounded-full border-0 bg-blue-50 px-3 py-1.5 text-blue-700">
                {watchedVariants.length} biến thể
              </Tag>
              <Tag className="rounded-full border-0 bg-emerald-50 px-3 py-1.5 text-emerald-700">
                {formatCurrency(watchedBasePrice)}
              </Tag>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:min-w-[320px]">
            <div className="rounded-2xl border border-black/5 bg-gray-50 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Tên preview
              </div>
              <div className="mt-2 line-clamp-2 text-base font-semibold text-gray-900">
                {watchedName || 'Tên sản phẩm sẽ hiển thị tại đây'}
              </div>
            </div>
            <div className="rounded-2xl border border-black/5 bg-gray-50 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Biến thể đã tạo
              </div>
              <div className="mt-2 text-xl font-semibold text-gray-900">
                {watchedVariants.length}
              </div>
            </div>
          </div>
        </div>
      </section>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        initialValues={{ category: 'Giày Nam' }}
        size="large"
      >
        <Row gutter={[24, 24]}>
          <Col xs={24} xl={17}>
            <Card
              title="Thông tin chung"
              bordered={false}
              className="mb-6 rounded-[28px] border border-black/5 shadow-[0_18px_60px_rgba(15,23,42,0.06)]"
            >
              <Row gutter={[20, 0]}>
                <Col xs={24}>
                  <Form.Item
                    label="Tên sản phẩm"
                    name="name"
                    rules={[{ required: true, message: 'Vui lòng nhập tên sản phẩm' }]}
                  >
                    <Input placeholder="VD: Nike Air Jordan 1 Low" className="font-medium" />
                  </Form.Item>
                </Col>

                <Col xs={24}>
                  <Form.Item label="Mô tả sản phẩm" name="description">
                    <TextArea
                      rows={5}
                      placeholder="Nhập mô tả chi tiết, chất liệu, công nghệ..."
                      showCount
                      maxLength={2000}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item
                    label="Giá niêm yết"
                    name="basePrice"
                    rules={[{ required: true, message: 'Vui lòng nhập giá niêm yết' }]}
                  >
                    <InputNumber<number>
                      className="w-full"
                      addonAfter="VND"
                      formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={(value: string | undefined) => {
                        if (!value) return 0;
                        return parseFloat(value.replace(/\$\s?|(,*)/g, ''));
                      }}
                      placeholder="0"
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item label="Danh mục" name="category">
                    <Select
                      options={[
                        { value: 'Giày Nam', label: 'Giày Nam' },
                        { value: 'Giày Nữ', label: 'Giày Nữ' },
                        { value: 'Trẻ Em', label: 'Trẻ Em' },
                        { value: 'Phụ Kiện', label: 'Phụ Kiện' },
                      ]}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            <Card
              bordered={false}
              className="rounded-[28px] border border-black/5 shadow-[0_18px_60px_rgba(15,23,42,0.06)]"
              title={
                <div className="flex items-center gap-2">
                  <span>Danh sách biến thể</span>
                  <Tag color="blue" className="rounded-full px-3 py-1">
                    Màu & size
                  </Tag>
                </div>
              }
              extra={
                <Button
                  type="primary"
                  icon={<RobotOutlined />}
                  onClick={() => setIsGeneratorOpen(true)}
                  className="!h-10 !rounded-full !bg-black !px-5 !shadow-none"
                >
                  Tạo nhanh
                </Button>
              }
            >
              <Form.List name="variants">
                {(fields, { remove }) => {
                  const columns: ColumnsType<FormListField> = [
                    {
                      title: 'Thông tin SKU',
                      key: 'sku',
                      width: '38%',
                      render: (_, field) => (
                        <div className="flex flex-col gap-2">
                          <Form.Item name={[field.name, 'skuCode']} noStyle>
                            <Input
                              prefix={<BarcodeOutlined className="text-gray-400" />}
                              className="!border-none !bg-gray-50 !font-mono !text-xs"
                              readOnly
                            />
                          </Form.Item>

                          <Space size={6} wrap>
                            <Tag color="geekblue" className="rounded-full px-3 py-1">
                              {form.getFieldValue(['variants', field.name, 'color']) as string}
                            </Tag>
                            <Tag className="rounded-full px-3 py-1 font-semibold">
                              {form.getFieldValue(['variants', field.name, 'size']) as string}
                            </Tag>
                          </Space>

                          <Form.Item name={[field.name, 'imageUrl']} hidden>
                            <Input />
                          </Form.Item>
                        </div>
                      ),
                    },
                    {
                      title: 'Giá bán lẻ',
                      key: 'price',
                      width: '24%',
                      render: (_, field) => (
                        <Form.Item name={[field.name, 'price']} style={{ marginBottom: 0 }}>
                          <InputNumber<number>
                            className="w-full"
                            formatter={(value) =>
                              `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                            }
                            parser={(value: string | undefined) => {
                              if (!value) return 0;
                              return parseFloat(value.replace(/\$\s?|(,*)/g, ''));
                            }}
                            controls={false}
                            addonAfter="đ"
                          />
                        </Form.Item>
                      ),
                    },
                    {
                      title: 'Tồn kho',
                      key: 'stock',
                      width: '18%',
                      render: (_, field) => (
                        <Form.Item name={[field.name, 'initialQuantity']} style={{ marginBottom: 0 }}>
                          <InputNumber className="w-full" placeholder="0" />
                        </Form.Item>
                      ),
                    },
                    {
                      title: '',
                      key: 'action',
                      width: '10%',
                      align: 'center',
                      render: (_, field) => (
                        <Tooltip title="Xóa biến thể này">
                          <Button
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => remove(field.name)}
                          />
                        </Tooltip>
                      ),
                    },
                  ];

                  if (fields.length === 0) {
                    return (
                      <div className="rounded-[24px] border border-dashed border-gray-300 bg-gray-50 py-16 text-center">
                        <RobotOutlined className="mb-3 text-4xl text-gray-300" />
                        <p className="mb-4 text-gray-500">Chưa có biến thể nào được tạo.</p>
                        <Button type="dashed" onClick={() => setIsGeneratorOpen(true)}>
                          Mở công cụ tạo nhanh
                        </Button>
                      </div>
                    );
                  }

                  return (
                    <Table<FormListField>
                      dataSource={fields}
                      pagination={false}
                      rowKey={(record) => record.key}
                      size="middle"
                      className="overflow-hidden rounded-2xl border border-black/5"
                      columns={columns}
                    />
                  );
                }}
              </Form.List>
            </Card>
          </Col>

          <Col xs={24} xl={7}>
            <div className="space-y-6 xl:sticky xl:top-6">
              <Card
                bordered={false}
                className="rounded-[28px] border border-black/5 shadow-[0_18px_60px_rgba(15,23,42,0.06)]"
              >
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                  Preview nhanh
                </div>

                <div className="mt-4 rounded-[24px] bg-gradient-to-br from-gray-900 to-black p-6 text-white">
                  <div className="text-xs uppercase tracking-[0.2em] text-white/45">
                    {watchedCategory || 'Giày Nam'}
                  </div>
                  <div className="mt-3 text-2xl font-semibold leading-tight">
                    {watchedName || 'Tên sản phẩm'}
                  </div>
                  <div className="mt-4 text-sm text-white/65">
                    {watchedVariants.length > 0
                      ? `${watchedVariants.length} biến thể đã sẵn sàng`
                      : 'Tạo biến thể để hoàn thiện sản phẩm'}
                  </div>
                  <div className="mt-6 text-2xl font-semibold">
                    {formatCurrency(watchedBasePrice)}
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-gray-50 p-4">
                    <div className="text-xs text-gray-400">Biến thể</div>
                    <div className="mt-2 font-semibold text-gray-900">
                      {watchedVariants.length}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-gray-50 p-4">
                    <div className="text-xs text-gray-400">Danh mục</div>
                    <div className="mt-2 font-semibold text-gray-900">
                      {watchedCategory || 'Giày Nam'}
                    </div>
                  </div>
                </div>
              </Card>

              <Card
                bordered={false}
                className="rounded-[28px] border border-black/5 bg-blue-50/70 shadow-[0_18px_60px_rgba(15,23,42,0.06)]"
              >
                <div className="space-y-4 text-gray-600">
                  <div className="flex items-start gap-3">
                    <CloudUploadOutlined className="mt-1 text-xl text-blue-500" />
                    <div>
                      <span className="block font-semibold text-gray-800">Tự động hóa ảnh</span>
                      <span className="text-sm leading-6">
                        Hệ thống sẽ ưu tiên ảnh của biến thể đầu tiên làm thumbnail chính nếu
                        bạn chưa nhập ảnh đại diện riêng.
                      </span>
                    </div>
                  </div>

                  <Divider style={{ margin: '12px 0' }} />

                  <div className="flex items-start gap-3">
                    <FileImageOutlined className="mt-1 text-xl text-green-500" />
                    <div>
                      <span className="block font-semibold text-gray-800">URL hình ảnh</span>
                      <span className="text-sm leading-6">
                        Nên dùng link ảnh public, kích thước đồng đều và đủ sắc nét để trải
                        nghiệm quản trị và storefront đẹp hơn.
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </Col>
        </Row>

        <div className="fixed bottom-0 left-0 z-50 w-full border-t border-black/5 bg-white/90 px-4 py-4 backdrop-blur-md md:px-8">
          <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-4">
            <div className="hidden text-sm text-gray-500 md:block">
              Kiểm tra lại tên sản phẩm, giá niêm yết và danh sách biến thể trước khi lưu.
            </div>

            <div className="ml-auto flex gap-3">
              <Button size="large" onClick={() => router.back()} className="min-w-[110px] rounded-full">
                Hủy bỏ
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                loading={loading}
                size="large"
                className="!min-w-[160px] !rounded-full !bg-black !shadow-none"
              >
                Lưu sản phẩm
              </Button>
            </div>
          </div>
        </div>
      </Form>

      <Modal
        title={
          <div className="flex items-center gap-2">
            <RobotOutlined className="text-blue-600" />
            <span className="font-bold">Công cụ tạo SKU hàng loạt</span>
          </div>
        }
        open={isGeneratorOpen}
        onCancel={() => setIsGeneratorOpen(false)}
        onOk={handleBulkGenerate}
        okText="Tạo biến thể"
        cancelText="Đóng"
        width={760}
        centered
        maskClosable={false}
      >
        <Form layout="vertical" className="mt-4">
          <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50 p-5">
            <Form.Item
              label={<span className="font-bold text-blue-900">Mã Model</span>}
              required
              style={{ marginBottom: 0 }}
              tooltip="Ví dụ: JD1, AF1, YZ350..."
            >
              <Input
                value={genModelCode}
                onChange={(e) => setGenModelCode(e.target.value)}
                placeholder="VD: JD1"
                size="large"
                className="!font-black !uppercase !tracking-widest !text-blue-900"
                prefix={<BarcodeOutlined />}
                suffix={
                  <span className="text-xs uppercase text-gray-400">
                    {genModelCode || 'CODE'}
                  </span>
                }
              />
            </Form.Item>

            <div className="mt-2 flex items-center gap-2 text-xs text-blue-600">
              <span>Preview:</span>
              <Tag className="m-0 rounded-full border-blue-200 bg-white font-mono">
                {genModelCode ? genModelCode.toUpperCase() : 'CODE'}-
                {genColor ? genColor.toUpperCase() : 'COLOR'}-SIZE
              </Tag>
            </div>
          </div>

          <Row gutter={16}>
            <Col span={10}>
              <Form.Item label="Tên màu">
                <Input
                  value={genColor}
                  onChange={(e) => setGenColor(e.target.value)}
                  placeholder="Nhập tên màu..."
                />
              </Form.Item>
            </Col>
            <Col span={14}>
              <Form.Item label="Chọn size">
                <Select
                  mode="tags"
                  style={{ width: '100%' }}
                  placeholder="VD: 39, 40, 41, 42"
                  value={genSizes}
                  onChange={setGenSizes}
                  tokenSeparators={[',', ' ']}
                  suffixIcon={<InboxOutlined />}
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider style={{ margin: '12px 0 24px 0' }} />

          <div className="mb-5 rounded-2xl border border-black/5 bg-gray-50 p-5">
            <span className="mb-4 flex items-center gap-2 font-bold text-gray-700">
              <FileImageOutlined />
              Hình ảnh cho màu này
            </span>

            <Form.Item label="Ảnh đại diện" style={{ marginBottom: 12 }}>
              <Input
                value={genImage}
                onChange={(e) => setGenImage(e.target.value)}
                placeholder="Paste URL ảnh đại diện tại đây..."
                addonBefore="URL"
              />
            </Form.Item>

            <div className="mb-2 text-sm font-medium text-gray-600">Bộ sưu tập:</div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {genGallery.map((url, index) => (
                <Input
                  key={index}
                  value={url}
                  onChange={(e) => updateGenGallery(index, e.target.value)}
                  placeholder={`Ảnh chi tiết ${index + 1}`}
                  size="small"
                  prefix={<span className="text-xs text-gray-400">#{index + 1}</span>}
                />
              ))}
            </div>
          </div>

          <Form.Item label="Giá bán lẻ riêng (tùy chọn)">
            <InputNumber
              style={{ width: '100%' }}
              value={genPrice}
              onChange={setGenPrice}
              placeholder="Để trống nếu muốn dùng giá gốc của sản phẩm"
              addonBefore={<DollarOutlined />}
              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}