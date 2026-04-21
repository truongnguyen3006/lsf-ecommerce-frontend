import type { OrderResponse } from '@/services/orderApi';

export interface OrderStatusMeta {
  color: 'green' | 'gold' | 'blue' | 'red' | 'default' | 'magenta' | 'cyan';
  label: string;
  step: number;
  description: string;
}

export interface TrackingStepItem {
  title: string;
  description?: string;
  status: 'wait' | 'process' | 'finish' | 'error';
}

type TrackingSnapshot = Pick<OrderResponse, 'status'> & {
  reservationState?: string;
  hasReservation?: boolean;
};

const releaseStates = new Set(['RELEASED', 'EXPIRED']);

function normalizeStatus(status: string) {
  return status.toUpperCase();
}

function normalizeReservationState(state?: string) {
  return (state || '').toUpperCase();
}

export function getOrderStatusMeta(status: string): OrderStatusMeta {
  switch (normalizeStatus(status)) {
    case 'CREATED':
    case 'PENDING':
      return {
        color: 'gold',
        label: 'Đã tiếp nhận',
        step: 1,
        description: 'Đơn hàng đã được tiếp nhận và đang chuẩn bị giữ chỗ.',
      };
    case 'VALIDATED':
      return {
        color: 'blue',
        label: 'Đã giữ chỗ',
        step: 2,
        description: 'Hệ thống đã giữ chỗ và đang chờ kết quả thanh toán.',
      };
    case 'PROCESSING':
    case 'PAID':
      return {
        color: 'blue',
        label: 'Đang chờ chốt đơn',
        step: 3,
        description: 'Đã có kết quả thanh toán và hệ thống đang chốt bước cuối.',
      };
    case 'CONFIRMED':
      return {
        color: 'cyan',
        label: 'Đã xác nhận giữ chỗ',
        step: 4,
        description: 'Giữ chỗ đã được xác nhận sau khi thanh toán thành công.',
      };
    case 'COMPLETED':
    case 'DELIVERED':
    case 'SHIPPING':
      return {
        color: 'green',
        label: 'Hoàn tất',
        step: 4,
        description: 'Đơn hàng đã đi xong nhánh thành công.',
      };
    case 'PAYMENT_FAILED':
      return {
        color: 'magenta',
        label: 'Thanh toán thất bại',
        step: 4,
        description: 'Thanh toán không thành công và hệ thống đang trả lại giữ chỗ.',
      };
    case 'FAILED':
    case 'CANCELLED':
      return {
        color: 'red',
        label: 'Không hoàn tất',
        step: 4,
        description: 'Đơn hàng không thể tiếp tục và đã dừng ở nhánh lỗi.',
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

export function getOrderTrackingSteps(order: TrackingSnapshot): TrackingStepItem[] {
  const normalizedStatus = normalizeStatus(order.status);
  const reservationState = normalizeReservationState(order.reservationState);
  const hasReservation = order.hasReservation ?? Boolean(reservationState && reservationState !== 'NOT_FOUND');

  const steps: TrackingStepItem[] = [
    { title: 'Tiếp nhận đơn', status: 'finish', description: 'Đơn đã được ghi nhận.' },
    { title: 'Giữ chỗ tồn kho', status: 'wait' },
    { title: 'Chờ / xử lý thanh toán', status: 'wait' },
    { title: 'Hoàn tất hoặc hoàn lại', status: 'wait' },
  ];

  switch (normalizedStatus) {
    case 'CREATED':
    case 'PENDING':
      steps[1].status = 'process';
      steps[1].description = 'Hệ thống đang gửi yêu cầu giữ chỗ.';
      return steps;
    case 'VALIDATED':
      steps[1].status = 'finish';
      steps[1].description = 'Đơn hàng đã được giữ chỗ.';
      steps[2].status = 'process';
      steps[2].description = 'Đơn đang trong thời gian chờ thanh toán.';
      return steps;
    case 'PROCESSING':
    case 'PAID':
      steps[1].status = 'finish';
      steps[2].status = 'finish';
      steps[3].status = 'process';
      steps[3].description = 'Đã có tín hiệu thanh toán, hệ thống đang chốt giữ chỗ.';
      return steps;
    case 'CONFIRMED':
      return steps.map((step) => ({ ...step, status: 'finish' }));
    case 'COMPLETED':
    case 'DELIVERED':
    case 'SHIPPING':
      steps[1].status = 'finish';
      steps[1].description = 'Đơn hàng đã được giữ chỗ.';
      steps[2].status = 'finish';
      steps[2].description = 'Thanh toán đã thành công.';
      if (reservationState === 'CONFIRMED') {
        steps[3].status = 'finish';
        steps[3].description = 'Giữ chỗ đã được xác nhận và đơn đã hoàn tất.';
      } else {
        steps[3].status = 'process';
        steps[3].description = 'Hệ thống đang xác nhận giữ chỗ để chốt đơn.';
      }
      return steps;
    case 'PAYMENT_FAILED':
      steps[1].status = 'finish';
      steps[1].description = 'Đơn đã được giữ chỗ trước khi thanh toán.';
      steps[2].status = 'error';
      steps[2].description = 'Thanh toán thất bại hoặc đã quá thời gian chờ.';
      if (releaseStates.has(reservationState)) {
        steps[3].status = 'finish';
        steps[3].description =
          reservationState === 'EXPIRED'
            ? 'Giữ chỗ đã hết hạn và được trả lại.'
            : 'Giữ chỗ đã được trả lại.';
      } else {
        steps[3].status = 'process';
        steps[3].description = 'Hệ thống đang trả lại giữ chỗ.';
      }
      return steps;
    case 'FAILED':
    case 'CANCELLED':
      if (hasReservation) {
        steps[1].status = 'finish';
        steps[1].description = 'Đơn đã từng được giữ chỗ.';
        steps[2].status = 'error';
        steps[2].description = 'Luồng xử lý đã dừng trước khi hoàn tất.';
        if (releaseStates.has(reservationState)) {
          steps[3].status = 'finish';
          steps[3].description = 'Giữ chỗ đã được trả lại.';
        } else {
          steps[3].status = 'process';
          steps[3].description = 'Hệ thống đang thu hồi giữ chỗ còn lại.';
        }
      } else {
        steps[1].status = 'error';
        steps[1].description = 'Không thể giữ chỗ cho đơn hàng.';
        steps[2].status = 'wait';
        steps[3].status = 'wait';
      }
      return steps;
    default:
      steps[1].status = 'process';
      steps[1].description = 'Hệ thống đang cập nhật lại trạng thái giữ chỗ.';
      return steps;
  }
}
