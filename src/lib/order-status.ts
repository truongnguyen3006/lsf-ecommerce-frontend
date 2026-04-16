import type { OrderResponse } from '@/services/orderApi';

export interface OrderStatusMeta {
  color: 'green' | 'gold' | 'blue' | 'red' | 'default' | 'magenta' | 'purple' | 'cyan';
  label: string;
  step: number;
  description: string;
}

export interface TrackingStepItem {
  title: string;
  description?: string;
  status: 'wait' | 'process' | 'finish' | 'error';
}

export function getOrderStatusMeta(status: string): OrderStatusMeta {
  switch (status.toUpperCase()) {
    case 'CREATED':
    case 'PENDING':
      return {
        color: 'gold',
        label: 'Chờ xử lý',
        step: 1,
        description: 'Đơn hàng đã được ghi nhận và đang chờ xử lý.',
      };
    case 'VALIDATED':
      return {
        color: 'blue',
        label: 'Đã giữ chỗ',
        step: 2,
        description: 'Sản phẩm đã được giữ chỗ tạm thời và hệ thống đang chờ kết quả thanh toán.',
      };
    case 'CONFIRMED':
      return {
        color: 'cyan',
        label: 'Đã xác nhận',
        step: 4,
        description: 'Giữ chỗ đã được xác nhận sau khi thanh toán thành công.',
      };
    case 'PROCESSING':
    case 'PAID':
      return {
        color: 'blue',
        label: 'Đang xử lý',
        step: 3,
        description: 'Hệ thống đang xử lý kết quả thanh toán cho đơn hàng.',
      };
    case 'SHIPPING':
      return {
        color: 'cyan',
        label: 'Đang giao hàng',
        step: 3,
        description: 'Đơn hàng đã được bàn giao cho đơn vị vận chuyển.',
      };
    case 'COMPLETED':
    case 'DELIVERED':
      return {
        color: 'green',
        label: 'Hoàn tất',
        step: 5,
        description: 'Đơn hàng đã hoàn tất thành công.',
      };
    case 'PAYMENT_FAILED':
      return {
        color: 'magenta',
        label: 'Thanh toán thất bại',
        step: 4,
        description: 'Thanh toán không thành công và phần giữ chỗ sẽ được hoàn lại.',
      };
    case 'FAILED':
    case 'CANCELLED':
      return {
        color: 'red',
        label: 'Thất bại',
        step: 5,
        description: 'Đơn hàng không thể hoàn tất và phần giữ chỗ sẽ được hoàn lại nếu đã giữ trước đó.',
      };
    default:
      return {
        color: 'default',
        label: status || 'Đang cập nhật',
        step: 1,
        description: 'Trạng thái đơn hàng đang được cập nhật.',
      };
  }
}

export function getOrderTrackingSteps(order: Pick<OrderResponse, 'status'>): TrackingStepItem[] {
  const normalizedStatus = order.status.toUpperCase();

  const steps: TrackingStepItem[] = [
    { title: 'Tiếp nhận đơn', description: 'Đơn hàng đã được ghi nhận.', status: 'finish' },
    { title: 'Giữ chỗ tồn kho', description: 'Hệ thống tạm giữ số lượng cần thiết cho đơn hàng.', status: 'wait' },
    { title: 'Xử lý thanh toán', description: 'Đang chờ hoặc đang nhận kết quả thanh toán.', status: 'wait' },
    { title: 'Xác nhận hoặc hoàn lại', description: 'Sau thanh toán, phần giữ chỗ sẽ được xác nhận hoặc hoàn lại.', status: 'wait' },
    { title: 'Hoàn tất đơn', description: 'Đơn hàng được chốt thành công hoặc kết thúc ở nhánh lỗi.', status: 'wait' },
  ];

  switch (normalizedStatus) {
    case 'PENDING':
    case 'CREATED':
      steps[1].status = 'process';
      break;
    case 'VALIDATED':
      steps[1].status = 'finish';
      steps[2].status = 'process';
      break;
    case 'PROCESSING':
    case 'PAID':
      steps[1].status = 'finish';
      steps[2].status = 'finish';
      steps[3].status = 'process';
      break;
    case 'CONFIRMED':
      steps[1].status = 'finish';
      steps[2].status = 'finish';
      steps[3].status = 'finish';
      steps[4].status = 'process';
      break;
    case 'COMPLETED':
    case 'DELIVERED':
      return steps.map((step) => ({ ...step, status: 'finish' }));
    case 'PAYMENT_FAILED':
      steps[1].status = 'finish';
      steps[2].status = 'error';
      steps[3].status = 'finish';
      steps[4].status = 'error';
      return steps;
    case 'FAILED':
    case 'CANCELLED':
      steps[1].status = 'error';
      steps[2].status = 'wait';
      steps[3].status = 'finish';
      steps[4].status = 'error';
      return steps;
    default:
      steps[1].status = 'process';
      break;
  }

  return steps;
}
