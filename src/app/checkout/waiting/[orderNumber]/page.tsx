'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Button, Card, Result, Spin, Steps, Tag, Typography } from 'antd';
import { HomeOutlined, LoadingOutlined, ReloadOutlined, WifiOutlined } from '@ant-design/icons';
import { orderApi, type OrderResponse } from '@/services/orderApi';
import { getOrderStatusMeta, getOrderTrackingSteps } from '@/lib/order-status';

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

const TERMINAL_STATUSES = new Set<OrderStatus>(['COMPLETED', 'FAILED', 'PAYMENT_FAILED', 'CANCELLED']);
const POLLING_INTERVAL_MS = 3000;
const STALE_RECHECK_MS = 12000;

interface NotificationMessage {
  status: OrderStatus;
  message: string;
}

interface PageState {
  status: OrderStatus;
  msg: string;
}

type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
type SyncSource = 'api' | 'realtime' | 'initial';

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
          Đã kết nối trực tiếp
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

function isTerminalStatus(status: OrderStatus) {
  return TERMINAL_STATUSES.has(status);
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

  const [state, setState] = useState<PageState>({
    status: 'PENDING',
    msg: 'Đơn hàng đã được tiếp nhận và đang được xử lý.',
  });
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [lastSyncSource, setLastSyncSource] = useState<SyncSource>('initial');
  const [isPollingSync, setIsPollingSync] = useState(false);

  const trackingSteps = useMemo(() => getOrderTrackingSteps({ status: state.status }), [state.status]);
  const currentStepIndex = useMemo(() => getCurrentStepIndex(trackingSteps), [trackingSteps]);

  useEffect(() => {
    latestStatusRef.current = state.status;
  }, [state.status]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
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

      if (isTerminalStatus(latestStatusRef.current)) return;

      watchdogTimeoutRef.current = window.setTimeout(() => {
        if (!isTerminalStatus(latestStatusRef.current)) {
          void fetchStatus('api');
        }
      }, STALE_RECHECK_MS);
    };

    const applyStatus = (status: OrderStatus, message: string, source: SyncSource) => {
      if (!mountedRef.current) return;

      latestStatusRef.current = status;
      setState({
        status,
        msg: message || getOrderStatusMeta(status).description,
      });
      setLastSyncedAt(new Date().toLocaleTimeString('vi-VN'));
      setLastSyncSource(source);
    };

    const fetchStatus = async (source: SyncSource = 'api') => {
      if (!orderNumber || inflightStatusRef.current) return;
      if (isTerminalStatus(latestStatusRef.current) && source !== 'initial') return;

      inflightStatusRef.current = true;
      if (source === 'api') {
        setIsPollingSync(true);
      }

      try {
        const data: OrderResponse = await orderApi.getOrderById(orderNumber);
        if (!data?.status) return;

        applyStatus(data.status as OrderStatus, getOrderStatusMeta(data.status).description, source);
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
        if (isTerminalStatus(latestStatusRef.current)) {
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
                'realtime',
              );

              if (isTerminalStatus(notification.status)) {
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

  const syncHint = lastSyncedAt
    ? `Cập nhật gần nhất: ${lastSyncedAt}${lastSyncSource === 'realtime' ? ' • trực tiếp' : ' • kiểm tra lại tự động'}`
    : 'Đang đồng bộ trạng thái đơn hàng';

  if (state.status === 'COMPLETED') {
    return (
      <div className="app-shell animate-fade-in py-10">
        <Card className="app-surface border-0">
          <Result
            status="success"
            title={<span className="text-3xl font-semibold tracking-tight">Đặt hàng thành công</span>}
            subTitle={`Mã đơn hàng: ${orderNumber}. Đơn hàng đã được xác nhận thành công.`}
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
          <div className="space-y-3 px-6 pb-8 md:px-12">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {getConnectionTag(connectionState)}
              <Tag color="blue">{syncHint}</Tag>
            </div>
            <Steps current={trackingSteps.length - 1} items={trackingSteps} responsive />
          </div>
        </Card>
      </div>
    );
  }

  const isFailure = ['FAILED', 'PAYMENT_FAILED', 'CANCELLED'].includes(state.status);

  if (isFailure) {
    return (
      <div className="app-shell animate-fade-in py-10">
        <Card className="app-surface border-0">
          <Result
            status="error"
            title={<span className="text-3xl font-semibold tracking-tight">Đơn hàng không hoàn tất</span>}
            subTitle={state.msg}
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
              <Tag color="blue">{syncHint}</Tag>
            </div>
            <Steps current={currentStepIndex} items={trackingSteps} responsive />
            <div className="rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 text-sm text-[var(--color-secondary)]">
              {state.status === 'PAYMENT_FAILED'
                ? 'Thanh toán chưa thành công nên phần giữ chỗ sẽ được hoàn lại trước khi đơn hàng kết thúc.'
                : 'Đơn hàng đã dừng ở nhánh lỗi. Nếu trước đó đã giữ chỗ, hệ thống sẽ hoàn lại số lượng tương ứng.'}
            </div>
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
          <Text className="text-base text-[var(--color-secondary)]">{state.msg}</Text>

          <div className="mx-auto mt-10 max-w-4xl rounded-[28px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-6">
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
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-left">
              <Tag color="blue">{syncHint}</Tag>
              <Button icon={<ReloadOutlined />} onClick={() => window.location.reload()}>
                Tải lại
              </Button>
            </div>
            <Steps current={currentStepIndex} items={trackingSteps} responsive />
          </div>
        </div>
      </Card>
    </div>
  );
}
