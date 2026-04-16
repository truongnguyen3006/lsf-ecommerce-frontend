"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Col,
  Divider,
  Form,
  Image,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Skeleton,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  FileImageOutlined,
  RobotOutlined,
  SaveOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import { useParams, useRouter } from "next/navigation";
import type { ColumnsType } from "antd/es/table";
import { AxiosError } from "axios";
import Link from "next/link";
import axiosClient from "@/lib/axiosClient";
import { productApi } from "@/services/productApi";
import type {
  CreateProductRequest,
  CreateVariantRequest,
  Product,
  ProductVariant,
} from "@/types";

type VariantItem = NonNullable<Product["variants"]>[number] & {
  isActive?: boolean;
};

type EditableVariant = ProductVariant & {
  isActive?: boolean;
  initialQuantity?: number;
};

type EditableProduct = Omit<Product, "variants"> & {
  variants: EditableVariant[];
};

interface InventoryGetResponse {
  skuCode: string;
  quantity: number;
}

interface InventoryAvailabilityResponse {
  skuCode: string;
  physicalStock: number;
  quotaUsed: number;
  reservedCount: number;
  confirmedCount: number;
  availableStock: number;
  quotaKey: string;
  refreshedAtEpochMs: number;
}

interface InventoryAdjustResponse {
  skuCode: string;
  newQuantity?: number;
  status?: string;
}

interface ApiErrorResponse {
  error: string;
  message?: string;
}

const { Title, Text } = Typography;

function formatCurrency(value?: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(value ?? 0);
}

export default function EditProductPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const productId = Number(params.id);

  const [form] = Form.useForm();
  const [modalForm] = Form.useForm();

  const [messageApi, contextHolder] = message.useMessage();
  const [product, setProduct] = useState<EditableProduct | null>(null);
  const [loading, setLoading] = useState(false);

  const [stockInputs, setStockInputs] = useState<Record<string, number>>({});
  const [stockLoading, setStockLoading] = useState<Record<string, boolean>>({});
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<VariantItem | null>(
    null,
  );
  const [originalColor, setOriginalColor] = useState("");

  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [genModelCode, setGenModelCode] = useState("");
  const [genColor, setGenColor] = useState("");
  const [genSizes, setGenSizes] = useState<string[]>([]);
  const [genPrice, setGenPrice] = useState<number | null>(null);
  const [genImage, setGenImage] = useState("");
  const [genGallery, setGenGallery] = useState<string[]>(["", "", "", ""]);
  const [availabilityMap, setAvailabilityMap] = useState<
    Record<string, InventoryAvailabilityResponse>
  >({});

  const totalVariants = product?.variants?.length ?? 0;

  const activeVariants = useMemo(
    () =>
      (product?.variants ?? []).filter((variant) => variant.isActive !== false)
        .length,
    [product?.variants],
  );

  const totalStock = useMemo(
    () => Object.values(quantities).reduce((sum, value) => sum + value, 0),
    [quantities],
  );

  const totalAvailableStock = useMemo(
    () =>
      Object.values(availabilityMap).reduce(
        (sum, item) => sum + (item?.availableStock ?? 0),
        0,
      ),
    [availabilityMap],
  );

  const fetchQuantities = async (variants: VariantItem[]) => {
    const nextQuantities: Record<string, number> = {};

    await Promise.all(
      variants.map(async (variant) => {
        try {
          const res = (await axiosClient.get(
            `/api/inventory/${variant.skuCode}`,
          )) as InventoryGetResponse;
          nextQuantities[variant.skuCode] =
            typeof res.quantity === "number" ? res.quantity : 0;
        } catch {
          nextQuantities[variant.skuCode] = 0;
        }
      }),
    );

    setQuantities(nextQuantities);
  };

  const fetchProduct = async () => {
    try {
      const data = (await productApi.getById(productId)) as Product;

      const normalizedProduct: EditableProduct = {
        ...data,
        variants: (data.variants ?? []).map((variant) => ({
          ...variant,
          isActive: variant.isActive ?? true,
          initialQuantity: quantities[variant.skuCode] ?? 0,
        })),
      };

      setProduct(normalizedProduct);

      form.setFieldsValue({
        name: data.name,
        description: data.description,
        basePrice: data.price,
        imageUrl: data.imageUrl,
        category: data.category,
      });

      if (data.variants && data.variants.length > 0) {
        const firstSku = data.variants[0].skuCode;
        const prefix = firstSku.split("-")[0];
        setGenModelCode(prefix);
        await fetchQuantities(data.variants);
        await fetchAvailabilities(data.variants);
      } else if (data.name) {
        const suggest = data.name
          .replace(/[^a-zA-Z0-9]/g, "")
          .toUpperCase()
          .substring(0, 3);
        setGenModelCode(suggest);
      }
    } catch {
      router.push("/admin/products");
    }
  };

  const buildUpdatePayload = (
    currentProduct: EditableProduct,
    variants: EditableVariant[],
  ): CreateProductRequest => ({
    name: currentProduct.name ?? "",
    description: currentProduct.description ?? "",
    basePrice: currentProduct.price ?? 0,
    imageUrl: currentProduct.imageUrl ?? "",
    category: currentProduct.category ?? "",
    galleryImages: currentProduct.galleryImages ?? [],
    variants: variants.map<CreateVariantRequest>((variant) => ({
      skuCode: variant.skuCode ?? "",
      color: variant.color ?? "",
      size: variant.size ?? "",
      price: variant.price ?? 0,
      imageUrl: variant.imageUrl ?? "",
      galleryImages: variant.galleryImages ?? [],
      initialQuantity:
        quantities[variant.skuCode] ?? variant.initialQuantity ?? 0,
      isActive: variant.isActive ?? true,
    })),
  });

  useEffect(() => {
    if (productId) {
      void fetchProduct();
    }
  }, [productId]);

  const handleUpdateInfo = async (values: Partial<CreateProductRequest>) => {
    setLoading(true);

    try {
      await productApi.update(productId, values);
      messageApi.success("Đã lưu thông tin chung");
      await fetchProduct();
    } catch (error: unknown) {
      messageApi.error("Lỗi lưu thông tin");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustStock = async (skuCode: string) => {
    const quantity = stockInputs[skuCode];
    if (!quantity) return;

    setStockLoading((prev) => ({ ...prev, [skuCode]: true }));

    try {
      const payload = {
        skuCode,
        adjustmentQuantity: quantity,
        reason: "Admin Edit",
      };

      const res = (await axiosClient.post(
        "/api/inventory/adjust",
        payload,
      )) as InventoryAdjustResponse;

      if (res.newQuantity !== undefined) {
        messageApi.open({
          type: "success",
          content: `Kho mới: ${res.newQuantity}`,
          icon: <CheckCircleOutlined style={{ color: "#52c41a" }} />,
        });

        setQuantities((prev) => ({
          ...prev,
          [skuCode]: res.newQuantity ?? 0,
        }));
        await fetchAvailabilityBySku(skuCode);
      }

      setStockInputs((prev) => {
        const nextState = { ...prev };
        delete nextState[skuCode];
        return nextState;
      });
    } catch (error: unknown) {
      const axiosError = error as AxiosError<ApiErrorResponse>;
      messageApi.error(axiosError.response?.data?.error || "Lỗi cập nhật kho");
      const apiError = error as {
        response?: {
          status?: number;
          data?: {
            error?: string;
            message?: string;
            minimumAllowedPhysicalStock?: number;
            quotaUsed?: number;
          };
        };
      };

      if (
        apiError.response?.status === 409 &&
        apiError.response?.data?.error === "PHYSICAL_STOCK_BELOW_QUOTA_USED"
      ) {
        message.error(
          `Không thể giảm tồn kho xuống dưới ${
            apiError.response.data.minimumAllowedPhysicalStock ??
            apiError.response.data.quotaUsed ??
            0
          } vì hiện có hàng đang được giữ/xác nhận.`,
        );
        return;
      }

      message.error("Không thể cập nhật tồn kho.");
    } finally {
      setStockLoading((prev) => ({ ...prev, [skuCode]: false }));
    }
  };

  const openEditModal = (variant: VariantItem) => {
    setEditingVariant(variant);
    setOriginalColor(variant.color);

    modalForm.setFieldsValue({
      skuCode: variant.skuCode,
      color: variant.color,
      size: variant.size,
      price: variant.price,
      imageUrl: variant.imageUrl,
      galleryImages: variant.galleryImages || ["", "", "", ""],
    });

    setIsEditModalOpen(true);
  };

  const handleSaveSingleVariant = async () => {
    try {
      const values = await modalForm.validateFields();
      let updatedVariants: EditableVariant[] = product?.variants
        ? [...product.variants]
        : [];

      const cleanGallery = (values.galleryImages as string[]).filter(
        (img) => img && img.trim() !== "",
      );
      const newColorClean = values.color
        .trim()
        .toUpperCase()
        .replace(/[^a-zA-Z0-9]/g, "");

      const generateNewSku = (oldSku: string, newColorPart: string) => {
        const parts = oldSku.split("-");

        if (parts.length >= 2) {
          const prefix = parts[0];
          const size = parts[parts.length - 1];
          return `${prefix}-${newColorPart}-${size}`;
        }

        return oldSku;
      };

      updatedVariants = updatedVariants.map((variant) => {
        if (variant.skuCode === editingVariant?.skuCode) {
          const isColorChanged =
            variant.color.toLowerCase() !== values.color.trim().toLowerCase();
          const finalSku = isColorChanged
            ? generateNewSku(variant.skuCode, newColorClean)
            : variant.skuCode;

          return {
            ...variant,
            ...values,
            skuCode: finalSku,
            galleryImages: cleanGallery,
          };
        }

        if (variant.color.toLowerCase() === originalColor.toLowerCase()) {
          const newSkuForOther = generateNewSku(variant.skuCode, newColorClean);

          return {
            ...variant,
            skuCode: newSkuForOther,
            color: values.color,
            imageUrl: values.imageUrl,
            galleryImages: cleanGallery,
          };
        }

        return variant;
      });

      if (!product) return;

      await productApi.update(
        productId,
        buildUpdatePayload(product, updatedVariants),
      );

      if (originalColor.toLowerCase() !== values.color.trim().toLowerCase()) {
        messageApi.success("Đã cập nhật màu và tạo lại SKU mới");
      } else {
        messageApi.success("Cập nhật biến thể thành công");
      }

      setIsEditModalOpen(false);
      await fetchProduct();
    } catch {
      messageApi.error("Lỗi khi lưu biến thể");
    }
  };

  const handleBulkGenerate = async () => {
    if (!genColor || genSizes.length === 0) {
      messageApi.warning("Vui lòng nhập màu và ít nhất 1 size");
      return;
    }

    const currentVariants: EditableVariant[] = product?.variants
      ? [...product.variants]
      : [];

    const newVariants: EditableVariant[] = genSizes.map((size) => ({
      skuCode: `${genModelCode.toUpperCase().trim()}-${genColor
        .toUpperCase()
        .trim()}-${size}`,
      color: genColor,
      size,
      initialQuantity: 0,
      price: effectivePrice,
      imageUrl: genImage,
      galleryImages: validGallery,
      isActive: true,
    }));
    const validGallery = genGallery.filter((url) => url.trim() !== "");

    const effectivePrice =
      genPrice !== null && genPrice > 0 ? genPrice : product?.price || 0;

    const duplicate = newVariants.find((newVariant) =>
      currentVariants.some(
        (currentVariant) => currentVariant.skuCode === newVariant.skuCode,
      ),
    );

    if (duplicate) {
      messageApi.error(`SKU ${duplicate.skuCode} đã tồn tại`);
      return;
    }

    try {
      if (!product) return;

      await productApi.update(
        productId,
        buildUpdatePayload(product, [...currentVariants, ...newVariants]),
      );

      messageApi.success(`Đã thêm mới ${genSizes.length} size`);
      setIsGeneratorOpen(false);
      setGenColor("");
      setGenSizes([]);
      setGenImage("");
      setGenGallery(["", "", "", ""]);
      await fetchProduct();
    } catch {
      messageApi.error("Lỗi khi thêm biến thể");
    }
  };

  const handleToggleStatus = async (skuCode: string, checked: boolean) => {
    if (!product || !product.variants) return;

    const updatedVariants = product.variants.map((variant) =>
      variant.skuCode === skuCode ? { ...variant, isActive: checked } : variant,
    );

    try {
      setProduct({ ...product, variants: updatedVariants });

      if (!product) return;

      await productApi.update(
        productId,
        buildUpdatePayload(product, updatedVariants),
      );

      messageApi.success(checked ? `Đã hiện ${skuCode}` : `Đã ẩn ${skuCode}`);
    } catch {
      messageApi.error("Lỗi cập nhật trạng thái");
      await fetchProduct();
    }
  };

  const handleDeleteVariant = async (skuCode: string) => {
    Modal.confirm({
      title: "Xóa vĩnh viễn biến thể?",
      content: (
        <div>
          <p>
            Bạn đang xóa SKU: <b>{skuCode}</b>
          </p>
          <p className="text-xs text-red-500">
            Lưu ý: dữ liệu sẽ mất hoàn toàn.
          </p>
        </div>
      ),
      okText: "Xóa vĩnh viễn",
      okButtonProps: { danger: true },
      cancelText: "Hủy",
      onOk: async () => {
        const updatedVariants = (product?.variants ?? []).filter(
          (variant) => variant.skuCode !== skuCode,
        );

        if (!product) return;

        await productApi.update(
          productId,
          buildUpdatePayload(product, updatedVariants),
        );

        messageApi.success("Đã xóa biến thể khỏi hệ thống");
        await fetchProduct();
      },
    });
  };

  const updateGenGallery = (index: number, value: string) => {
    const nextGallery = [...genGallery];
    nextGallery[index] = value;
    setGenGallery(nextGallery);
  };

  const fetchAvailabilityBySku = async (skuCode: string) => {
    try {
      const res = (await axiosClient.get(
        `/api/inventory/${skuCode}/availability`,
      )) as InventoryAvailabilityResponse;

      setAvailabilityMap((prev) => ({
        ...prev,
        [skuCode]: res,
      }));
    } catch {
      setAvailabilityMap((prev) => {
        const next = { ...prev };
        delete next[skuCode];
        return next;
      });
    }
  };

  const fetchAvailabilities = async (variants: VariantItem[]) => {
    const nextAvailability: Record<string, InventoryAvailabilityResponse> = {};

    await Promise.all(
      variants.map(async (variant) => {
        try {
          const res = (await axiosClient.get(
            `/api/inventory/${variant.skuCode}/availability`,
          )) as InventoryAvailabilityResponse;
          nextAvailability[variant.skuCode] = res;
        } catch {
          // bỏ qua, không chặn màn admin
        }
      }),
    );

    setAvailabilityMap(nextAvailability);
  };

  const variantColumns: ColumnsType<VariantItem> = [
    {
      title: "Ảnh",
      dataIndex: "imageUrl",
      key: "imageUrl",
      width: 76,
      align: "center",
      render: (url: string) => (
        <Image
          src={url}
          width={48}
          height={48}
          className="rounded-xl border border-black/5 object-cover"
          fallback="https://via.placeholder.com/48"
          preview={false}
        />
      ),
    },
    {
      title: "Biến thể",
      key: "info",
      render: (_, record) => (
        <div className={record.isActive === false ? "opacity-50" : ""}>
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            SKU
          </div>
          <div className="font-mono text-sm font-bold text-gray-800">
            {record.skuCode}
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            <Tag color="blue" className="rounded-full px-3 py-1">
              {record.color}
            </Tag>
            <Tag className="rounded-full px-3 py-1 font-semibold">
              {record.size}
            </Tag>
            {record.isActive === false ? (
              <Tag color="error">Đang ẩn</Tag>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      title: "Giá",
      dataIndex: "price",
      width: 140,
      render: (price: number) => (
        <span className="font-semibold text-gray-900">
          {formatCurrency(price)}
        </span>
      ),
    },
    {
      title: "Tồn vật lý",
      key: "physicalStock",
      width: 120,
      align: "center",
      render: (_, record) => {
        const quantity = quantities[record.skuCode];

        if (quantity === undefined) {
          return <span className="text-gray-400">...</span>;
        }

        return (
          <span
            className={
              quantity > 0
                ? "font-bold text-blue-600"
                : "font-bold text-red-500"
            }
          >
            {quantity}
          </span>
        );
      },
    },
    {
      title: "Khả dụng",
      key: "availableStock",
      width: 120,
      align: "center",
      render: (_, record) => {
        const availability = availabilityMap[record.skuCode];

        if (!availability) {
          return <span className="text-gray-400">...</span>;
        }

        return (
          <div className="leading-5">
            <div
              className={
                availability.availableStock > 0
                  ? "font-bold text-emerald-600"
                  : "font-bold text-red-500"
              }
            >
              {availability.availableStock}
            </div>
            <div className="text-[11px] text-gray-400">
              Giữ: {availability.quotaUsed}
            </div>
          </div>
        );
      },
    },
    {
      title: "Nhập / xuất kho vật lý",
      key: "adjustment",
      width: 190,
      render: (_, record) => (
        <Space.Compact style={{ width: "100%" }}>
          <InputNumber
            placeholder="+ / -"
            value={stockInputs[record.skuCode]}
            onChange={(value) =>
              setStockInputs((prev) => ({
                ...prev,
                [record.skuCode]: value || 0,
              }))
            }
            onPressEnter={() => handleAdjustStock(record.skuCode)}
            style={{ width: "100%" }}
          />
          <Button
            type="primary"
            icon={<SyncOutlined />}
            loading={stockLoading[record.skuCode]}
            onClick={() => handleAdjustStock(record.skuCode)}
            className="!bg-black !shadow-none"
          />
        </Space.Compact>
      ),
    },
    {
      title: "Hiển thị",
      key: "status",
      width: 120,
      align: "center",
      render: (_, record) => (
        <Switch
          checkedChildren="Hiện"
          unCheckedChildren="Ẩn"
          checked={record.isActive !== false}
          onChange={(checked) => handleToggleStatus(record.skuCode, checked)}
        />
      ),
    },
    {
      key: "actions",
      width: 88,
      align: "center",
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Sửa chi tiết">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => openEditModal(record)}
            />
          </Tooltip>
          <Tooltip title="Xóa vĩnh viễn">
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteVariant(record.skuCode)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  if (!product) {
    return (
      <div className="p-8">
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1480px] px-4 pb-24 pt-6 md:px-6 xl:px-8">
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
                Sản phẩm
              </div>
              <Title
                level={1}
                className="!mb-2 !mt-2 !text-[34px] !font-semibold !tracking-tight"
              >
                {product.name}
              </Title>
              <Text className="max-w-3xl text-base leading-7 text-gray-500">
                Tối ưu thông tin chung, kiểm soát tồn kho và quản lý biến thể
                theo màu sắc – kích thước trong cùng một màn hình.
              </Text>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Tag className="rounded-full border-0 bg-gray-100 px-3 py-1.5 text-gray-700">
                {product.category || "Chưa phân loại"}
              </Tag>
              <Tag className="rounded-full border-0 bg-blue-50 px-3 py-1.5 text-blue-700">
                {totalVariants} biến thể
              </Tag>
              <Tag className="rounded-full border-0 bg-emerald-50 px-3 py-1.5 text-emerald-700">
                {activeVariants} đang hiển thị
              </Tag>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:min-w-[320px]">
            <div className="rounded-2xl border border-black/5 bg-gray-50 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Giá hiện tại
              </div>
              <div className="mt-2 text-xl font-semibold text-gray-900">
                {formatCurrency(product.price)}
              </div>
            </div>
            <div className="rounded-2xl border border-black/5 bg-gray-50 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Tổng tồn vật lý
              </div>
              <div className="mt-2 text-xl font-semibold text-gray-900">
                {totalStock}
              </div>
            </div>
            <div className="rounded-2xl border border-black/5 bg-gray-50 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Tổng khả dụng
              </div>
              <div className="mt-2 text-xl font-semibold text-gray-900">
                {totalAvailableStock}
              </div>
            </div>
          </div>
        </div>
      </section>

      <Row gutter={[24, 24]}>
        <Col xs={24} xl={17}>
          <Card
            bordered={false}
            className="overflow-hidden rounded-[28px] border border-black/5 shadow-[0_18px_60px_rgba(15,23,42,0.06)]"
          >
            <Tabs
              defaultActiveKey="variants"
              className="[&_.ant-tabs-nav]:mb-8 [&_.ant-tabs-tab]:px-0 [&_.ant-tabs-tab]:pr-8"
              items={[
                {
                  key: "general",
                  label: "Thông tin chung",
                  children: (
                    <Form
                      form={form}
                      layout="vertical"
                      onFinish={handleUpdateInfo}
                    >
                      <Row gutter={[20, 0]}>
                        <Col xs={24}>
                          <Form.Item
                            label="Tên sản phẩm"
                            name="name"
                            rules={[
                              {
                                required: true,
                                message: "Vui lòng nhập tên sản phẩm",
                              },
                            ]}
                          >
                            <Input placeholder="Tên sản phẩm" />
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={12}>
                          <Form.Item label="Giá gốc" name="basePrice">
                            <InputNumber
                              style={{ width: "100%" }}
                              formatter={(value) =>
                                `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                              }
                              addonAfter="VND"
                              placeholder="0"
                            />
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={12}>
                          <Form.Item label="Danh mục" name="category">
                            <Select
                              options={[
                                { value: "Giày Nam", label: "Giày Nam" },
                                { value: "Giày Nữ", label: "Giày Nữ" },
                                { value: "Trẻ Em", label: "Trẻ Em" },
                                { value: "Phụ Kiện", label: "Phụ Kiện" },
                              ]}
                            />
                          </Form.Item>
                        </Col>

                        <Col xs={24}>
                          <Form.Item label="Ảnh đại diện" name="imageUrl">
                            <Input placeholder="Nhập URL ảnh đại diện" />
                          </Form.Item>
                        </Col>

                        <Col xs={24}>
                          <Form.Item label="Mô tả" name="description">
                            <Input.TextArea
                              rows={5}
                              placeholder="Mô tả ngắn gọn, rõ ràng..."
                            />
                          </Form.Item>
                        </Col>
                      </Row>

                      <div className="mt-2 flex justify-end">
                        <Button
                          type="primary"
                          htmlType="submit"
                          loading={loading}
                          icon={<SaveOutlined />}
                          className="!h-11 !rounded-full !bg-black !px-6 !shadow-none"
                        >
                          Lưu thay đổi
                        </Button>
                      </div>
                    </Form>
                  ),
                },
                {
                  key: "variants",
                  label: `Biến thể (${totalVariants})`,
                  children: (
                    <div>
                      <div className="mb-5 flex flex-col gap-4 rounded-[24px] border border-blue-100 bg-blue-50/70 p-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="text-sm font-semibold text-blue-900">
                            Quản lý màu sắc, size và tồn kho
                          </div>
                          <div className="mt-1 text-sm text-blue-700">
                            Bulk Add giúp tạo nhanh nhiều size cùng 1 màu trong
                            một lần thao tác.
                          </div>
                        </div>

                        <Button
                          type="dashed"
                          icon={<RobotOutlined />}
                          onClick={() => setIsGeneratorOpen(true)}
                          className="!h-11 !rounded-full !border-blue-200 !bg-white !px-5 !text-blue-700"
                        >
                          Thêm màu / size hàng loạt
                        </Button>
                      </div>

                      <Table
                        dataSource={product.variants}
                        columns={variantColumns}
                        rowKey="skuCode"
                        scroll={{ x: 920 }}
                        pagination={{
                          defaultPageSize: 5,
                          showSizeChanger: true,
                          pageSizeOptions: ["5", "10", "20", "50"],
                          showTotal: (total) => `Tổng ${total} biến thể`,
                          position: ["bottomRight"],
                        }}
                      />
                    </div>
                  ),
                },
              ]}
            />
          </Card>
        </Col>

        <Col xs={24} xl={7}>
          <div className="space-y-6 xl:sticky xl:top-6">
            <Card
              bordered={false}
              className="overflow-hidden rounded-[28px] border border-black/5 shadow-[0_18px_60px_rgba(15,23,42,0.06)]"
            >
              <div className="overflow-hidden rounded-[24px] bg-gray-100">
                <Image
                  src={product.imageUrl}
                  alt={product.name}
                  className="aspect-[4/5] w-full object-cover"
                  fallback="https://via.placeholder.com/600x750?text=No+Image"
                />
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                    Preview
                  </div>
                  <div className="mt-2 text-xl font-semibold text-gray-900">
                    {product.name}
                  </div>
                  <div className="mt-1 text-sm text-gray-500">
                    {product.category || "Danh mục chưa có"}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-gray-50 p-4">
                    <div className="text-xs text-gray-400">Giá</div>
                    <div className="mt-2 font-semibold text-gray-900">
                      {formatCurrency(product.price)}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-gray-50 p-4">
                    <div className="text-xs text-gray-400">Biến thể</div>
                    <div className="mt-2 font-semibold text-gray-900">
                      {totalVariants}
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <Card
              bordered={false}
              className="rounded-[28px] border border-black/5 bg-gradient-to-br from-gray-900 to-black text-white shadow-[0_18px_60px_rgba(15,23,42,0.12)]"
            >
              <div className="text-sm font-semibold uppercase tracking-[0.18em] text-white/50">
                Gợi ý quản trị
              </div>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-white/80">
                <li>
                  • Dùng ảnh thumbnail rõ nét để nhìn đẹp hơn ở danh sách sản
                  phẩm.
                </li>
                <li>
                  • Với cùng một màu, nên đồng bộ gallery để trải nghiệm duyệt
                  ảnh nhất quán.
                </li>
                <li>
                  • Ẩn biến thể hết hàng thay vì xóa nếu bạn vẫn muốn giữ lịch
                  sử SKU.
                </li>
              </ul>
            </Card>
          </div>
        </Col>
      </Row>

      <Modal
        title={
          <span className="flex items-center gap-2">
            Sửa biến thể
            <Tag color="orange" className="rounded-full px-3">
              {editingVariant?.skuCode}
            </Tag>
          </span>
        }
        open={isEditModalOpen}
        onOk={handleSaveSingleVariant}
        onCancel={() => setIsEditModalOpen(false)}
        destroyOnClose
        width={720}
        okText="Lưu thay đổi"
        cancelText="Đóng"
      >
        <Form form={modalForm} layout="vertical" className="mt-5">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Màu sắc"
                name="color"
                rules={[{ required: true, message: "Vui lòng nhập tên màu" }]}
                help="Đổi màu sẽ cập nhật cho cả nhóm size cùng màu."
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Size" name="size">
                <Input disabled className="!bg-gray-100 !text-gray-500" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Giá bán riêng" name="price">
            <InputNumber
              style={{ width: "100%" }}
              formatter={(value) =>
                `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
              }
              addonAfter="VND"
              placeholder="0"
            />
          </Form.Item>

          <Divider>Hình ảnh</Divider>

          <Form.Item label="Ảnh đại diện" name="imageUrl">
            <Input prefix={<FileImageOutlined />} allowClear />
          </Form.Item>

          <div className="rounded-2xl border border-black/5 bg-gray-50 p-4">
            <div className="mb-3 text-sm font-semibold text-gray-700">
              Bộ sưu tập ảnh
            </div>
            <Form.List name="galleryImages">
              {() => (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {[0, 1, 2, 3].map((index) => (
                    <Form.Item key={index} name={index} noStyle>
                      <Input
                        placeholder={`Link ảnh chi tiết ${index + 1}`}
                        size="small"
                        prefix={
                          <span className="text-xs text-gray-400">
                            #{index + 1}
                          </span>
                        }
                      />
                    </Form.Item>
                  ))}
                </div>
              )}
            </Form.List>
          </div>
        </Form>
      </Modal>

      <Modal
        title={
          <div className="flex items-center gap-2">
            <RobotOutlined className="text-blue-600" />
            <b>Thêm biến thể hàng loạt</b>
          </div>
        }
        open={isGeneratorOpen}
        onCancel={() => setIsGeneratorOpen(false)}
        onOk={handleBulkGenerate}
        okText="Tạo & lưu ngay"
        cancelText="Đóng"
        width={760}
        destroyOnClose
      >
        <Form layout="vertical" className="mt-4">
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
            <Form.Item label="Mã model" required style={{ marginBottom: 0 }}>
              <Input
                value={genModelCode}
                disabled
                className="!bg-blue-100 !font-bold !tracking-widest !text-blue-900"
              />
            </Form.Item>
          </div>

          <Row gutter={16} className="mt-4">
            <Col span={10}>
              <Form.Item label="Tên màu" required>
                <Input
                  value={genColor}
                  onChange={(e) => setGenColor(e.target.value)}
                  placeholder="VD: White"
                />
              </Form.Item>
            </Col>
            <Col span={14}>
              <Form.Item label="Các size" required>
                <Select
                  mode="tags"
                  value={genSizes}
                  onChange={setGenSizes}
                  placeholder="VD: 39, 40, 41"
                  tokenSeparators={[",", " "]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider style={{ margin: "12px 0 20px" }} />

          <Form.Item label="Thumbnail">
            <Input
              value={genImage}
              onChange={(e) => setGenImage(e.target.value)}
              addonBefore="URL"
            />
          </Form.Item>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            {genGallery.map((url, index) => (
              <Input
                key={index}
                size="small"
                value={url}
                onChange={(e) => updateGenGallery(index, e.target.value)}
                placeholder={`Ảnh ${index + 1}`}
              />
            ))}
          </div>

          <Form.Item label="Giá bán riêng (tùy chọn)" style={{ marginTop: 16 }}>
            <InputNumber
              style={{ width: "100%" }}
              value={genPrice}
              onChange={setGenPrice}
              formatter={(value) =>
                `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
              }
              addonAfter="VND"
              placeholder={`${new Intl.NumberFormat("vi-VN").format(product?.price || 0)} (mặc định)`}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
