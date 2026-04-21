import type { PaymentMethod } from '@/services/orderApi';

export interface PaymentMethodMeta {
  value: PaymentMethod;
  label: string;
  shortLabel: string;
  description: string;
  helper: string;
}

export const paymentMethodMetas: PaymentMethodMeta[] = [
  {
    value: 'MOCK_SUCCESS',
    label: 'Thành công mô phỏng',
    shortLabel: 'Thành công',
    description: 'Đơn được giữ chỗ trước, sau vài giây hệ thống báo thanh toán thành công.',
    helper: 'Dùng để xem nhánh xác nhận giữ chỗ.',
  },
  {
    value: 'MOCK_FAIL',
    label: 'Thất bại mô phỏng',
    shortLabel: 'Thất bại',
    description: 'Đơn được giữ chỗ trước, sau vài giây hệ thống báo thanh toán thất bại.',
    helper: 'Dùng để xem nhánh trả lại giữ chỗ.',
  },
  {
    value: 'MOCK_TIMEOUT',
    label: 'Quá hạn mô phỏng',
    shortLabel: 'Quá hạn',
    description: 'Đơn được giữ chỗ nhưng không có kết quả thanh toán ngay, chờ hết thời gian để trả lại.',
    helper: 'Dùng để xem đồng hồ đếm ngược và nhánh quá hạn.',
  },
  {
    value: 'COD',
    label: 'Thanh toán khi nhận hàng',
    shortLabel: 'COD',
    description: 'Nhánh phụ với xử lý đơn giản hơn sau khi đơn đã được giữ chỗ.',
    helper: 'Không phải trọng tâm của buổi demo.',
  },
];

export function getPaymentMethodMeta(paymentMethod?: string | null): PaymentMethodMeta {
  return (
    paymentMethodMetas.find((item) => item.value === paymentMethod) ??
    paymentMethodMetas[0]
  );
}
