'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Button, Card, Result, Spin, Steps, Tag, Typography } from 'antd';
import { HomeOutlined, LoadingOutlined, ReloadOutlined, WifiOutlined } from '@ant-design/icons';
import { inventoryApi, type OrderReservationItemResponse, type OrderReservationSummaryResponse } from '@/services/inventoryApi';
import { orderApi, type OrderResponse } from '@/services/orderApi';
import { getOrderStatusMeta, getOrderTrackingSteps } from '@/lib/order-status';
import { getPaymentMethodMeta } from '@/lib/payment-method';

const { Text, Title } = Typography;

type OrderStatus =
  | 'PENDING'
  | 'VALIDATED'
  | 'COMPLETED'
  | 'FAILED'
  | 'PAYMENT_FAILED'
  | 'PROCESSING'
  | 'SHIPPING'
  | 'CONFIRMED'
  | 'CANCELLED';

interface NotificationMessage {
  status: OrderStatus;
  message: string;
}

interface StatusState {
  status: OrderStatus;
  message: string;
}

type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
type SyncSource = 'api' | 'realtime' | 'initial';

const POLLING_INTERVAL_MS = 3000;
const STALE_RECHECK_MS = 12000;

function formatClock(value: number) {
  if (!value || value <= 0) return '00:00';
  const totalSeconds = Math.ceil(value / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatDateTime(value?: number) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

function getCurrentStepIndex(steps: ReturnType<typeof getOrderTrackingSteps>) {
  const processIndex = steps.findIndex((step) => step.status === 'process');
  if (processIndex >= 0) return processIndex;

  const errorIndex = steps.findIndex((step) => step.status === 'error');
  if (errorIndex >= 0) return errorIndex;

  return Math.max(steps.length - 1, 0);
}

function getConnectionTag(state: ConnectionState) {
  switch (state) {
    case 'connected':
      return (
        <Tag color="green" icon={<WifiOutlined />}>
          Đang theo dõi trực tiếp
        </Tag>
      );
    case 'reconnecting':
      return <Tag color="gold">Đang kết nối lại</Tag>;
    case 'disconnected':
      return <Tag>Mất kết nối</Tag>;
    default:
      return <Tag color="blue">Đang kết nối</Tag>;
  }
}

function getReservationTag(state?: string) {
  switch ((state || '').toUpperCase()) {
    case 'RESERVED':
      return <Tag color="gold">Đang giữ chỗ</Tag>;
    case 'CONFIRMED':
      return <Tag color="green">Đã xác nhận</Tag>;
    case 'RELEASED':
      return <Tag color="blue">Đã trả lại</Tag>;
    case 'EXPIRED':
      return <Tag color="red">Đã hết hạn</Tag>;
    case 'NOT_FOUND':
      return <Tag>Chưa có dữ liệu</Tag>;
    default:
      return <Tag>Đang cập nhật</Tag>;
  }
}

function isSuccessView(status: OrderStatus, reservationState?: string) {
  return status === 'COMPLETED' && (reservationState || '').toUpperCase() === 'CONFIRMED';
}

function isFailureView(status: OrderStatus, reservationState?: string) {
  const normalizedReservation = (reservationState || '').toUpperCase();
  if (status === 'PAYMENT_FAILED') {
    return normalizedReservation === 'RELEASED' || normalizedReservation === 'EXPIRED';
  }
  if (status === 'FAILED' || status === 'CANCELLED') {
    return (
      normalizedReservation === 'RELEASED' ||
      normalizedReservation === 'EXPIRED' ||
      normalizedReservation === 'NOT_FOUND' ||
      normalizedReservation === ''
    );
  }
  return false;
}

function isTerminalView(status: OrderStatus, reservationState?: string) {
  return isSuccessView(status, reservationState) || isFailureView(status, reservationState);
}

function deriveStatusMessage(
  status: OrderStatus,
  reservation: OrderReservationSummaryResponse | null,
  fallbackMessage: string,
): string {
  const reservationState = (reservation?.state || '').toUpperCase();

  if (status === 'VALIDATED') {
    return reservationState === 'RESERVED'
      ? 'Đơn đã được giữ chỗ và đang chờ kết quả thanh toán.'
      : 'Đơn hàng đang chờ kết quả thanh toán.';
  }

  if (status === 'COMPLETED') {
    return reservationState === 'CONFIRMED'
      ? 'Thanh toán thành công và giữ chỗ đã được xác nhận.'
      : 'Thanh toán đã thành công, hệ thống đang xác nhận giữ chỗ.';
  }

  if (status === 'PAYMENT_FAILED') {
    if (reservationState === 'EXPIRED') {
      return 'Đơn đã quá thời gian chờ thanh toán, giữ chỗ đã hết hạn và được trả lại.';
    }
    if (reservationState === 'RELEASED') {
      return 'Thanh toán không thành công, hệ thống đã trả lại giữ chỗ.';
    }
    return 'Thanh toán không thành công, hệ thống đang trả lại giữ chỗ.';
  }

  if (status === 'FAILED' || status === 'CANCELLED') {
    if (reservationState === 'RELEASED') {
      return 'Đơn hàng không thể tiếp tục và giữ chỗ đã được trả lại.';
    }
    if (reservationState === 'NOT_FOUND' || !reservationState) {
      return 'Đơn hàng không thể tiếp tục ngay từ bước giữ chỗ.';
    }
  }

  return fallbackMessage || getOrderStatusMeta(status).description;
}

function renderReservationItem(item: OrderReservationItemResponse) {
  return (
    <div
      key={`${item.orderNumber}-${item.skuCode}`}
      className="rounded-[20px] border border-[var(--color-border)] bg-white px-4 py-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-[var(--color-primary)]">{item.skuCode}</div>
          <div className="mt-1 text-xs text-[var(--color-muted)]">Số lượng: {item.quantity}</div>
        </div>
        {getReservationTag(item.state)}
      </div>
      <div className="mt-3 space-y-1 text-sm text-[var(--color-secondary)]">
        <div>Giữ chỗ lúc: {formatDateTime(item.reservedAtMs)}</div>
        <div>Hết hạn lúc: {formatDateTime(item.expiresAtMs)}</div>
        {item.confirmedAtMs ? <div>Xác nhận lúc: {formatDateTime(item.confirmedAtMs)}</div> : null}
        {item.releasedAtMs ? <div>Trả lại lúc: {formatDateTime(item.releasedAtMs)}</div> : null}
        {item.reason ? <div>Lý do: {item.reason}</div> : null}
      </div>
    </div>
  );
}

export default function OrderWaitingPage() {
  const params = useParams();
  const router = useRouter();
  const orderNumber = params.orderNumber as string;

  const stompClientRef = useRef<Client | null>(null);
  const pollingIntervalRef = useRef<number | null>(null);
  const watchdogTimeoutRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const inflightStatusRef = useRef(false);
  const latestStatusRef = useRef<OrderStatus>('PENDING');
  const latestReservationStateRef = useRef('UNKNOWN');

  const [state, setState] = useState<StatusState>({
    status: 'PENDING',
    message: 'Đơn hàng đã được tiếp nhận và đang được xử lý.',
  });
  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [reservation, setReservation] = useState<OrderReservationSummaryResponse | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [isPollingSync, setIsPollingSync] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());

  const reservationState = reservation?.state || 'UNKNOWN';
  const paymentMethodMeta = getPaymentMethodMeta(order?.paymentMethod);
  const countdownMs = reservation?.countdownActive
    ? Math.max((reservation.expiresAtMs || 0) - nowMs, 0)
    : 0;

  const trackingSteps = useMemo(
    () =>
      getOrderTrackingSteps({
        status: state.status,
        reservationState,
        hasReservation: Boolean(reservation?.items?.length),
      }),
    [reservation?.items?.length, reservationState, state.status],
  );
  const currentStepIndex = useMemo(() => getCurrentStepIndex(trackingSteps), [trackingSteps]);
  const displayTrackingSteps = useMemo(
    () =>
      trackingSteps.map((step) => ({
        ...step,
        title: <div className="checkout-step-title">{step.title}</div>,
        description: step.description ? (
          <div className="checkout-step-description">{step.description}</div>
        ) : undefined,
      })),
    [trackingSteps],
  );
  const derivedMessage = useMemo(
    () => deriveStatusMessage(state.status, reservation, state.message),
    [reservation, state.message, state.status],
  );
  const successView = isSuccessView(state.status, reservationState);
  const failureView = isFailureView(state.status, reservationState);

  useEffect(() => {
    latestStatusRef.current = state.status;
  }, [state.status]);

  useEffect(() => {
    latestReservationStateRef.current = reservationState;
  }, [reservationState]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!orderNumber) return;

    const clearPollingInterval = () => {
      if (pollingIntervalRef.current !== null) {
        window.clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };

    const clearWatchdogTimeout = () => {
      if (watchdogTimeoutRef.current !== null) {
        window.clearTimeout(watchdogTimeoutRef.current);
        watchdogTimeoutRef.current = null;
      }
    };

    const scheduleWatchdog = (fetchStatus: (source: SyncSource) => Promise<void>) => {
      clearWatchdogTimeout();

      if (isTerminalView(latestStatusRef.current, latestReservationStateRef.current)) return;

      watchdogTimeoutRef.current = window.setTimeout(() => {
        if (!isTerminalView(latestStatusRef.current, latestReservationStateRef.current)) {
          void fetchStatus('api');
        }
      }, STALE_RECHECK_MS);
    };

    const applyStatus = (status: OrderStatus, message: string) => {
      if (!mountedRef.current) return;

      latestStatusRef.current = status;
      setState({
        status,
        message: message || getOrderStatusMeta(status).description,
      });
    };

    const fetchStatus = async (source: SyncSource = 'api') => {
      if (!orderNumber || inflightStatusRef.current) return;
      if (isTerminalView(latestStatusRef.current, latestReservationStateRef.current) && source !== 'initial') {
        return;
      }

      inflightStatusRef.current = true;
      if (source === 'api') {
        setIsPollingSync(true);
      }

      try {
        const [orderData, reservationData] = await Promise.all([
          orderApi.getOrderById(orderNumber),
          inventoryApi.getOrderReservation(orderNumber).catch(() => null),
        ]);

        if (orderData?.status) {
          setOrder(orderData);
          applyStatus(
            orderData.status as OrderStatus,
            getOrderStatusMeta(orderData.status).description,
          );
        }

        if (reservationData && mountedRef.current) {
          setReservation(reservationData);
          latestReservationStateRef.current = reservationData.state || 'UNKNOWN';
        }
      } catch (error) {
        console.error('Không thể đồng bộ trạng thái đơn hàng:', error);
      } finally {
        inflightStatusRef.current = false;
        if (source === 'api' && mountedRef.current) {
          setIsPollingSync(false);
        }
      }
    };

    const startPolling = () => {
      clearPollingInterval();

      pollingIntervalRef.current = window.setInterval(() => {
        if (isTerminalView(latestStatusRef.current, latestReservationStateRef.current)) {
          clearPollingInterval();
          return;
        }

        void fetchStatus('api');
      }, POLLING_INTERVAL_MS);
    };

    const connectWebSocket = () => {
      if (stompClientRef.current?.active) return;

      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:8087/ws';
      setConnectionState('connecting');

      const client = new Client({
        webSocketFactory: () => new SockJS(wsUrl),
        reconnectDelay: 5000,
        onConnect: () => {
          setConnectionState('connected');

          client.subscribe(`/topic/order/${orderNumber}`, (event) => {
            if (!event.body) return;

            try {
              const notification = JSON.parse(event.body) as NotificationMessage;
              applyStatus(
                notification.status,
                notification.message || getOrderStatusMeta(notification.status).description,
              );

              if (isTerminalView(notification.status, latestReservationStateRef.current)) {
                clearPollingInterval();
                clearWatchdogTimeout();
              } else {
                scheduleWatchdog(fetchStatus);
              }
            } catch (error) {
              console.error('Không đọc được cập nhật trạng thái:', error);
            }
          });

          void fetchStatus('api');
          scheduleWatchdog(fetchStatus);
        },
        onWebSocketClose: () => {
          setConnectionState('reconnecting');
          scheduleWatchdog(fetchStatus);
        },
        onStompError: () => {
          setConnectionState('reconnecting');
          scheduleWatchdog(fetchStatus);
        },
        onDisconnect: () => {
          setConnectionState('disconnected');
        },
      });

      client.activate();
      stompClientRef.current = client;
    };

    void fetchStatus('initial');
    connectWebSocket();
    startPolling();
    scheduleWatchdog(fetchStatus);

    return () => {
      clearPollingInterval();
      clearWatchdogTimeout();
      if (stompClientRef.current?.active) {
        setConnectionState('disconnected');
        void stompClientRef.current.deactivate();
      }
      stompClientRef.current = null;
    };
  }, [orderNumber]);

  const reservationSummary = (() => {
    if (!reservation) {
      return (
        <div className="rounded-[24px] border border-[var(--color-border)] bg-white px-4 py-4 text-sm text-[var(--color-secondary)]">
          Đang lấy dữ liệu giữ chỗ…
        </div>
      );
    }

    return (
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-[24px] border border-[var(--color-border)] bg-white px-4 py-4">
          <div className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">
            Kịch bản thanh toán
          </div>
          <div className="mt-2 text-base font-semibold text-[var(--color-primary)]">
            {paymentMethodMeta.label}
          </div>
          <div className="mt-1 text-sm text-[var(--color-secondary)]">{paymentMethodMeta.helper}</div>
        </div>
        <div className="rounded-[24px] border border-[var(--color-border)] bg-white px-4 py-4">
          <div className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">
            Trạng thái giữ chỗ
          </div>
          <div className="mt-2">{getReservationTag(reservation.state)}</div>
          <div className="mt-2 text-sm text-[var(--color-secondary)]">
            Hết hạn lúc {formatDateTime(reservation.expiresAtMs)}
          </div>
        </div>
        <div className="rounded-[24px] border border-[var(--color-border)] bg-white px-4 py-4">
          <div className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">
            Thời gian còn lại
          </div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-primary)]">
            {reservation.countdownActive ? formatClock(countdownMs) : '00:00'}
          </div>
          <div className="mt-2 text-sm text-[var(--color-secondary)]">
            {reservation.state === 'CONFIRMED'
              ? 'Đơn đã đi xong nhánh xác nhận.'
              : reservation.state === 'RELEASED'
                ? 'Giữ chỗ đã được trả lại.'
                : reservation.state === 'EXPIRED'
                  ? 'Giữ chỗ đã hết hạn.'
                  : 'Đồng hồ đang đếm ngược theo thời gian giữ chỗ.'}
          </div>
        </div>
      </div>
    );
  })();

  const reservationItems = reservation?.items?.length ? (
    <div className="grid gap-3 md:grid-cols-2">
      {reservation.items.map(renderReservationItem)}
    </div>
  ) : null;

  if (successView) {
    return (
      <div className="app-shell animate-fade-in py-10">
        <Card className="app-surface border-0">
          <Result
            status="success"
            title={<span className="text-3xl font-semibold tracking-tight">Đơn hàng đã hoàn tất</span>}
            subTitle={`Mã đơn hàng: ${orderNumber}. ${derivedMessage}`}
            extra={
              <div className="flex flex-wrap justify-center gap-3">
                <Button
                  type="primary"
                  size="large"
                  className="!bg-[var(--color-primary)] !shadow-none"
                  onClick={() => router.push('/')}
                >
                  Tiếp tục mua sắm
                </Button>
                <Button size="large" onClick={() => router.push('/orders')}>
                  Xem đơn hàng của tôi
                </Button>
              </div>
            }
          />
          <div className="space-y-4 px-6 pb-8 md:px-12">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {getConnectionTag(connectionState)}
              <Tag color={getOrderStatusMeta(state.status).color}>{getOrderStatusMeta(state.status).label}</Tag>
            </div>
            {reservationSummary}
            <Steps
              className="checkout-tracking-steps"
              current={displayTrackingSteps.length - 1}
              items={displayTrackingSteps}
              responsive
            />
            {reservationItems}
          </div>
        </Card>
      </div>
    );
  }

  if (failureView) {
    return (
      <div className="app-shell animate-fade-in py-10">
        <Card className="app-surface border-0">
          <Result
            status="error"
            title={<span className="text-3xl font-semibold tracking-tight">Đơn hàng không hoàn tất</span>}
            subTitle={derivedMessage}
            extra={
              <div className="flex flex-wrap justify-center gap-3">
                <Button danger type="primary" size="large" onClick={() => router.push('/checkout')}>
                  Thử lại
                </Button>
                <Button size="large" icon={<HomeOutlined />} onClick={() => router.push('/')}>
                  Về trang chủ
                </Button>
              </div>
            }
          />
          <div className="space-y-4 px-6 pb-8 md:px-12">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {getConnectionTag(connectionState)}
              <Tag color={getOrderStatusMeta(state.status).color}>{getOrderStatusMeta(state.status).label}</Tag>
            </div>
            {reservationSummary}
            <Steps
              className="checkout-tracking-steps"
              current={currentStepIndex}
              items={displayTrackingSteps}
              responsive
            />
            {reservationItems}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="app-shell animate-fade-in py-10">
      <Card className="app-surface border-0">
        <div className="px-2 py-8 text-center md:px-10 md:py-12">
          <Spin indicator={<LoadingOutlined style={{ fontSize: 64, color: '#111111' }} spin />} />
          <Title level={2} className="!mb-2 !mt-8 !font-semibold">
            Đơn hàng đang được xử lý
          </Title>
          <Text className="text-base text-[var(--color-secondary)]">{derivedMessage}</Text>

          <div className="mx-auto mt-10 max-w-5xl rounded-[28px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-left">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
                  Mã đơn hàng
                </div>
                <div className="mt-1 text-sm font-semibold text-[var(--color-primary)]">{orderNumber}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {isPollingSync ? <Tag color="processing">Đang kiểm tra lại</Tag> : null}
                {getConnectionTag(connectionState)}
              </div>
            </div>

            {reservationSummary}

            <div className="mt-4 mb-4 flex flex-wrap items-center justify-between gap-3 text-left">
              <div className="flex flex-wrap items-center gap-2">
                <Tag color={getOrderStatusMeta(state.status).color}>{getOrderStatusMeta(state.status).label}</Tag>
                {reservation ? getReservationTag(reservation.state) : null}
              </div>
              <Button icon={<ReloadOutlined />} onClick={() => window.location.reload()}>
                Tải lại
              </Button>
            </div>

            <Steps
              className="checkout-tracking-steps"
              current={currentStepIndex}
              items={displayTrackingSteps}
              responsive
            />

            {reservationItems ? <div className="mt-6">{reservationItems}</div> : null}
          </div>
        </div>
      </Card>
    </div>
  );
}
