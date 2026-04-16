"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Col,
  Collapse,
  Descriptions,
  Empty,
  Input,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Tag,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  ApiOutlined,
  DatabaseOutlined,
  LineChartOutlined,
  LinkOutlined,
} from "@ant-design/icons";
import DemoConsoleHeader from "@/components/admin/framework/DemoConsoleHeader";
import ReservationEvidencePanel from "@/components/admin/framework/ReservationEvidencePanel";
import WorkflowTimelinePanel from "@/components/admin/framework/WorkflowTimelinePanel";
import {
  frameworkSections,
  type FrameworkSectionKey,
} from "@/components/admin/framework/frameworkDemoConfig";
import {
  describeOutboxHealth,
  formatDateTime,
  formatDateTimeWithRelative,
  formatDurationMs,
  formatMetric,
  formatMillis,
  formatOutboxPrimaryTimeWithRelative,
  getSagaCatalog,
  healthTag,
  kafkaRecordMatchesOrder,
  normalizeToken,
  orderTag,
  outboxMatchesOrder,
  outboxTag,
  pendingSessionMatchesOrder,
  pickFocusedSaga,
  sagaMatchesOrder,
  sagaTag,
} from "@/components/admin/framework/frameworkEvidenceUtils";
import { systemLinks } from "@/constants/systemLinks";
import { inventoryApi, type InventoryAvailabilityResponse } from "@/services/inventoryApi";
import { orderApi, type OrderResponse } from "@/services/orderApi";
import {
  operationsVisibilityApi,
  type KafkaAdminIndex,
  type KafkaDlqRecord,
  type OutboxVisibilityRow,
  type RuntimeServiceSnapshot,
  type SagaAdminSnapshot,
  type SagaInstanceView,
  type SagaPendingSessionView,
  type VisibilitySkuOption,
} from "@/services/operationsVisibilityApi";

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function sortOutboxRows(rows: OutboxVisibilityRow[]) {
  return [...rows].sort((left, right) => {
    const leftTime = new Date(left.sentAt || left.createdAt || 0).getTime();
    const rightTime = new Date(right.sentAt || right.createdAt || 0).getTime();
    return rightTime - leftTime;
  });
}

function mergeOutboxRows(groups: OutboxVisibilityRow[][]) {
  const rowsByKey = new Map<string, OutboxVisibilityRow>();

  groups.flat().forEach((row) => {
    rowsByKey.set(row.eventId || `${row.id}`, row);
  });

  return sortOutboxRows(Array.from(rowsByKey.values())).slice(0, 40);
}

const QUERY_STALE_MS = 30_000;

export default function FrameworkEvidencePanel() {
  const [activeSection, setActiveSection] = useState<FrameworkSectionKey>("workflow");
  const [trackedOrderNumber, setTrackedOrderNumber] = useState("");
  const [selectedSku, setSelectedSku] = useState("");
  const [selectedKafkaTopic, setSelectedKafkaTopic] = useState("");
  const [outboxInput, setOutboxInput] = useState("");
  const [outboxFilter, setOutboxFilter] = useState("");

  const deferredTrackedOrderInput = useDeferredValue(trackedOrderNumber.trim());
  const deferredTrackedOrder = useDeferredValue(normalizeToken(trackedOrderNumber));
  const deferredOutboxFilter = useDeferredValue(outboxFilter.trim());
  const effectiveOutboxFilter = deferredOutboxFilter;

  const workflowActive = activeSection === "workflow";
  const failureActive = activeSection === "failure";
  const reservationActive = activeSection === "reservation";
  const outboxActive = activeSection === "outbox";
  const runtimeActive = activeSection === "runtime";
  const orderFocusActive = workflowActive || failureActive;

  const sagaQuery = useQuery<SagaAdminSnapshot>({
    queryKey: ["ops-saga-index"],
    queryFn: () => operationsVisibilityApi.getSagaSnapshot(),
    enabled: orderFocusActive,
    staleTime: QUERY_STALE_MS,
    retry: 1,
  });

  const ordersQuery = useQuery<OrderResponse[]>({
    queryKey: ["ops-orders"],
    queryFn: () => orderApi.getAdminOrders(),
    enabled: workflowActive,
    staleTime: QUERY_STALE_MS,
  });

  const recentOrders = useMemo(() => {
    return [...(ordersQuery.data || [])].sort(
      (left, right) =>
        new Date(right.orderDate || 0).getTime() - new Date(left.orderDate || 0).getTime(),
    );
  }, [ordersQuery.data]);

  const orderFromList = useMemo(
    () => recentOrders.find((row) => normalizeToken(row.orderNumber) === deferredTrackedOrder),
    [recentOrders, deferredTrackedOrder],
  );

  const trackedOrderDetailQuery = useQuery<OrderResponse>({
    queryKey: ["ops-order-detail", deferredTrackedOrderInput],
    queryFn: () => orderApi.getOrderById(deferredTrackedOrderInput),
    enabled: Boolean(deferredTrackedOrderInput) && !orderFromList,
    staleTime: QUERY_STALE_MS,
    retry: 0,
  });

  const skuQuery = useQuery<VisibilitySkuOption[]>({
    queryKey: ["ops-skus"],
    queryFn: () => operationsVisibilityApi.getSkuOptions(),
    enabled: reservationActive,
    staleTime: QUERY_STALE_MS,
  });

  const focusedOrder = orderFromList || trackedOrderDetailQuery.data;
  const focusedOrderSkuOptions = useMemo(
    () => uniqueStrings((focusedOrder?.orderLineItemsList || []).map((item) => item.skuCode)),
    [focusedOrder],
  );
  const outboxFocusKeys = useMemo(
    () => uniqueStrings([deferredTrackedOrderInput, ...focusedOrderSkuOptions]),
    [deferredTrackedOrderInput, focusedOrderSkuOptions],
  );

  const matchedOrderSku = useMemo(
    () =>
      focusedOrderSkuOptions.find(
        (skuCode) => normalizeToken(skuCode) === normalizeToken(selectedSku),
      ) || "",
    [focusedOrderSkuOptions, selectedSku],
  );

  const orderBoundSku = matchedOrderSku || focusedOrderSkuOptions[0] || "";

  const displayedTrackedSku = orderBoundSku || selectedSku;
  const effectiveSku = orderBoundSku || selectedSku || skuQuery.data?.[0]?.skuCode || "";

  const availabilityQuery = useQuery<InventoryAvailabilityResponse>({
    queryKey: ["ops-availability", effectiveSku],
    queryFn: () => inventoryApi.getAvailability(effectiveSku),
    enabled: reservationActive && Boolean(effectiveSku),
    staleTime: QUERY_STALE_MS,
    retry: 0,
  });

  const outboxQuery = useQuery<OutboxVisibilityRow[]>({
    queryKey: ["ops-outbox", effectiveOutboxFilter, deferredTrackedOrderInput, outboxFocusKeys],
    queryFn: async () => {
      if (effectiveOutboxFilter) {
        return operationsVisibilityApi.getOutboxRows({
          limit: 20,
          msgKey: effectiveOutboxFilter,
        });
      }

      if (deferredTrackedOrderInput) {
        const groups = await Promise.all(
          outboxFocusKeys.map((msgKey) =>
            operationsVisibilityApi.getOutboxRows({
              limit: 16,
              msgKey,
            }),
          ),
        );

        return mergeOutboxRows(groups);
      }

      return operationsVisibilityApi.getOutboxRows({ limit: 16 });
    },
    enabled: outboxActive,
    staleTime: 15_000,
    retry: 1,
  });

  const kafkaIndexQuery = useQuery<KafkaAdminIndex>({
    queryKey: ["ops-kafka-index"],
    queryFn: () => operationsVisibilityApi.getKafkaAdminIndex(),
    enabled: outboxActive,
    staleTime: QUERY_STALE_MS,
    retry: 1,
  });

  const kafkaTopicsQuery = useQuery<string[]>({
    queryKey: ["ops-kafka-topics"],
    queryFn: () => operationsVisibilityApi.getKafkaTopics(),
    enabled: outboxActive,
    staleTime: QUERY_STALE_MS,
    retry: 1,
  });

  const effectiveKafkaTopic = selectedKafkaTopic || kafkaTopicsQuery.data?.[0] || "";
  const kafkaRecordsQuery = useQuery<KafkaDlqRecord[]>({
    queryKey: ["ops-kafka-records", effectiveKafkaTopic],
    queryFn: () => operationsVisibilityApi.getKafkaRecords({ topic: effectiveKafkaTopic, limit: 8 }),
    enabled: outboxActive && Boolean(effectiveKafkaTopic),
    staleTime: 15_000,
    retry: 1,
  });

  const runtimeQuery = useQuery<RuntimeServiceSnapshot[]>({
    queryKey: ["ops-runtime"],
    queryFn: () => operationsVisibilityApi.getRuntimeSnapshots(),
    enabled: runtimeActive,
    staleTime: QUERY_STALE_MS,
    retry: 0,
  });

  const runtimeSummary = useMemo(() => {
    const services = runtimeQuery.data || [];
    return {
      healthy: services.filter((service) => service.healthStatus === "UP").length,
      total: services.length,
    };
  }, [runtimeQuery.data]);

  const sagaSummary = useMemo(() => {
    const summary = sagaQuery.data?.summary || {};
    return {
      active:
        (summary.WAITING || 0) +
        (summary.RUNNING || 0) +
        (summary.COMPENSATING || 0),
      completed: (summary.COMPLETED || 0) + (summary.COMPENSATED || 0),
      failed:
        (summary.FAILED || 0) +
        (summary.TIMED_OUT || 0) +
        (summary.COMPENSATION_FAILED || 0),
    };
  }, [sagaQuery.data]);

  const sagaCatalog = useMemo(() => getSagaCatalog(sagaQuery.data), [sagaQuery.data]);
  const focusedSaga = useMemo(
    () => (deferredTrackedOrder ? pickFocusedSaga(sagaQuery.data, deferredTrackedOrder) : undefined),
    [sagaQuery.data, deferredTrackedOrder],
  );

  const focusedPendingSession = useMemo(
    () =>
      deferredTrackedOrder
        ? (sagaQuery.data?.aggregator.pendingSessions || []).find((row) =>
            pendingSessionMatchesOrder(row, deferredTrackedOrder),
          )
        : undefined,
    [sagaQuery.data, deferredTrackedOrder],
  );

  const matchedSagaIds = useMemo(
    () =>
      new Set(
        sagaCatalog
          .filter((row) => deferredTrackedOrder && sagaMatchesOrder(row, deferredTrackedOrder))
          .map((row) => row.sagaId),
      ),
    [sagaCatalog, deferredTrackedOrder],
  );

  const filteredRecentFailures = useMemo(
    () =>
      deferredTrackedOrder
        ? (sagaQuery.data?.recentFailures || []).filter((row) =>
            sagaMatchesOrder(row, deferredTrackedOrder),
          )
        : sagaQuery.data?.recentFailures || [],
    [deferredTrackedOrder, sagaQuery.data?.recentFailures],
  );

  const filteredRecentCompensations = useMemo(
    () =>
      deferredTrackedOrder
        ? (sagaQuery.data?.recentCompensations || []).filter((row) =>
            sagaMatchesOrder(row, deferredTrackedOrder),
          )
        : sagaQuery.data?.recentCompensations || [],
    [deferredTrackedOrder, sagaQuery.data?.recentCompensations],
  );

  const filteredOverdueInstances = useMemo(
    () =>
      deferredTrackedOrder
        ? (sagaQuery.data?.overdueInstances || []).filter((row) =>
            sagaMatchesOrder(row, deferredTrackedOrder),
          )
        : sagaQuery.data?.overdueInstances || [],
    [deferredTrackedOrder, sagaQuery.data?.overdueInstances],
  );

  const filteredPendingSessions = useMemo(
    () =>
      deferredTrackedOrder
        ? (sagaQuery.data?.aggregator.pendingSessions || []).filter((row) =>
            pendingSessionMatchesOrder(row, deferredTrackedOrder),
          )
        : sagaQuery.data?.aggregator.pendingSessions || [],
    [deferredTrackedOrder, sagaQuery.data?.aggregator.pendingSessions],
  );

  const matchedKafkaRows = useMemo(
    () =>
      deferredTrackedOrder
        ? (kafkaRecordsQuery.data || []).filter((row) =>
            kafkaRecordMatchesOrder(row, deferredTrackedOrder),
          )
        : kafkaRecordsQuery.data || [],
    [kafkaRecordsQuery.data, deferredTrackedOrder],
  );

  const outboxHealth = useMemo(
    () => describeOutboxHealth(outboxQuery.data || []),
    [outboxQuery.data],
  );
  const outboxFocusKeyTokens = useMemo(
    () => outboxFocusKeys.map((key) => normalizeToken(key)),
    [outboxFocusKeys],
  );
  const outboxRowMatchesFocus = (row: OutboxVisibilityRow) =>
    outboxFocusKeyTokens.some((key) => outboxMatchesOrder(row, key));

  const orderOptions = useMemo(
    () =>
      recentOrders.slice(0, 12).map((row) => ({
        value: row.orderNumber,
        label: `${row.orderNumber} | ${row.status} | ${formatDateTime(row.orderDate)} | ${uniqueStrings(
          row.orderLineItemsList.map((item) => item.skuCode),
        )
          .slice(0, 3)
          .join(", ")}`,
      })),
    [recentOrders],
  );

  const skuOptions = useMemo(
    () =>
      (
        focusedOrderSkuOptions.length > 0
          ? focusedOrderSkuOptions
          : uniqueStrings((skuQuery.data || []).map((option) => option.skuCode))
      ).map((skuCode) => ({
        value: skuCode,
        label:
          (skuQuery.data || []).find((option) => option.skuCode === skuCode)?.label || skuCode,
      })),
    [focusedOrderSkuOptions, skuQuery.data],
  );

  const kafkaTopicOptions = useMemo(
    () =>
      (kafkaTopicsQuery.data || []).map((topic) => ({
        value: topic,
        label: topic,
      })),
    [kafkaTopicsQuery.data],
  );

  const handleSectionChange = (value: FrameworkSectionKey) => {
    setActiveSection(value);
  };

  const syncSkuToOrder = (order?: OrderResponse) => {
    const nextOrderSkus = uniqueStrings((order?.orderLineItemsList || []).map((item) => item.skuCode));

    if (nextOrderSkus.length === 0) {
      return;
    }

    const matchedSku = nextOrderSkus.find(
      (skuCode) => normalizeToken(skuCode) === normalizeToken(selectedSku),
    );

    setSelectedSku(matchedSku || nextOrderSkus[0]);
  };

  const handleTrackedOrderChange = (value?: string) => {
    const rawOrderNumber = value ? value.trim() : "";
    setTrackedOrderNumber(rawOrderNumber);

    if (!rawOrderNumber) {
      return;
    }

    const nextOrder = recentOrders.find(
      (row) => normalizeToken(row.orderNumber) === normalizeToken(rawOrderNumber),
    );

    if (nextOrder) {
      syncSkuToOrder(nextOrder);
    }
  };

  const handleTrackedSkuChange = (value?: string) => {
    setSelectedSku(value ? value.trim().toUpperCase() : "");
  };

  const applyOutboxFilter = (value?: string) => {
    const nextValue = value ? value.trim() : "";
    setOutboxInput(nextValue);
    setOutboxFilter(nextValue);
  };

  const resetOutboxManualFilter = () => {
    setOutboxInput("");
    setOutboxFilter("");
  };

  const handleKafkaTopicChange = (value?: string) => {
    setSelectedKafkaTopic(value || "");
  };

  const refreshAll = () => {
    const tasks: Array<Promise<unknown>> = [];

    if (deferredTrackedOrderInput && !orderFromList) {
      tasks.push(trackedOrderDetailQuery.refetch());
    }

    if (orderFocusActive) {
      tasks.push(sagaQuery.refetch());
    }

    if (workflowActive) {
      tasks.push(ordersQuery.refetch());
    }

    if (reservationActive) {
      tasks.push(skuQuery.refetch());
      if (effectiveSku) {
        tasks.push(availabilityQuery.refetch());
      }
    }

    if (outboxActive) {
      tasks.push(outboxQuery.refetch(), kafkaIndexQuery.refetch(), kafkaTopicsQuery.refetch());
      if (effectiveKafkaTopic) {
        tasks.push(kafkaRecordsQuery.refetch());
      }
    }

    if (runtimeActive) {
      tasks.push(runtimeQuery.refetch());
    }

    void Promise.all(tasks);
  };

  const orderColumns: ColumnsType<OrderResponse> = [
    {
      title: "Đơn hàng",
      render: (_, row) => {
        const isFocused = normalizeToken(row.orderNumber) === deferredTrackedOrder;
        return (
          <div>
            <div className="flex items-center gap-2">
              <div className="font-medium text-[var(--color-primary)]">{row.orderNumber}</div>
              {isFocused ? <Tag color="gold">Đang theo dõi</Tag> : null}
            </div>
            <div className="text-xs text-[var(--color-secondary)]">
              {row.orderLineItemsList.length} dòng sản phẩm
            </div>
          </div>
        );
      },
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      width: 150,
      render: (value: string) => orderTag(value),
    },
    {
      title: "Thời gian",
      dataIndex: "orderDate",
      width: 180,
      render: (value: string) => formatDateTime(value),
    },
  ];

  const outboxColumns: ColumnsType<OutboxVisibilityRow> = [
    {
      title: "Tạo lúc",
      dataIndex: "createdAt",
      width: 220,
      render: (_, row) => (
        <div className="font-medium">{formatOutboxPrimaryTimeWithRelative(row)}</div>
      ),
    },
    {
      title: "Sự kiện",
      render: (_, row) => (
        <div>
          <div className="flex items-center gap-2">
            <div className="font-medium text-[var(--color-primary)]">{row.eventType}</div>
            {outboxRowMatchesFocus(row) ? (
              <Tag color="gold">Đang theo dõi</Tag>
            ) : null}
          </div>
          <div className="text-xs text-[var(--color-secondary)]">{row.topic}</div>
        </div>
      ),
    },
    {
      title: "Message key",
      dataIndex: "msgKey",
      width: 220,
      render: (value: string | undefined, row) =>
        value ? (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => applyOutboxFilter(value)}
              className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-1 text-xs font-medium text-[var(--color-primary)] transition hover:border-[var(--color-primary)]"
            >
              {value}
            </button>
            <div className="text-[11px] text-[var(--color-secondary)]">{row.eventId}</div>
          </div>
        ) : (
          "—"
        ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      width: 110,
      render: (value: string) => outboxTag(value),
    },
  ];

  const kafkaColumns: ColumnsType<KafkaDlqRecord> = [
    {
      title: "Thời gian / offset",
      width: 150,
      render: (_, row) => (
        <div>
          <div className="font-medium">
            {row.partition}:{row.offset}
          </div>
          <div className="text-xs text-[var(--color-secondary)]">
            {formatDateTimeWithRelative(row.timestamp)}
          </div>
        </div>
      ),
    },
    {
      title: "Sự kiện",
      render: (_, row) => (
        <div>
          <div className="flex items-center gap-2">
            <div className="font-medium text-[var(--color-primary)]">
              {row.eventType || "Sự kiện không rõ"}
            </div>
            {deferredTrackedOrder && kafkaRecordMatchesOrder(row, deferredTrackedOrder) ? (
              <Tag color="gold">Đang theo dõi</Tag>
            ) : null}
          </div>
          <div className="text-xs text-[var(--color-secondary)]">{row.key || "Không có key"}</div>
          {row.correlationId ? (
            <div className="text-[11px] text-[var(--color-secondary)]">corr: {row.correlationId}</div>
          ) : null}
        </div>
      ),
    },
    {
      title: "Lý do",
      render: (_, row) => (
        <div className="text-sm text-[var(--color-secondary)]">
          {row.reason || row.exceptionClass || "Chưa có lý do lỗi"}
        </div>
      ),
    },
  ];

  const sagaColumns: ColumnsType<SagaInstanceView> = [
    {
      title: "Saga",
      render: (_, row) => (
        <div>
          <div className="flex items-center gap-2">
            <div className="font-medium text-[var(--color-primary)]">{row.sagaId}</div>
            {deferredTrackedOrder && sagaMatchesOrder(row, deferredTrackedOrder) ? (
              <Tag color="gold">Đang theo dõi</Tag>
            ) : null}
          </div>
          <div className="text-xs text-[var(--color-secondary)]">{row.definitionName}</div>
          {row.correlationId ? (
            <div className="text-[11px] text-[var(--color-secondary)]">corr: {row.correlationId}</div>
          ) : null}
        </div>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      width: 150,
      render: (value: string) => sagaTag(value),
    },
    {
      title: "Bước",
      width: 190,
      render: (_, row) => (
        <div>
          <div className="font-medium">{row.phase || "—"}</div>
          <div className="text-xs text-[var(--color-secondary)]">
            {row.currentStep || "Đã hoàn tất bước bù trừ"}
          </div>
        </div>
      ),
    },
    {
      title: "Cập nhật",
      width: 170,
      render: (_, row) => formatMillis(row.updatedAtMs),
    },
  ];

  const pendingSessionColumns: ColumnsType<SagaPendingSessionView> = [
    {
      title: "Đơn hàng",
      render: (_, row) => (
        <div>
          <div className="flex items-center gap-2">
            <div className="font-medium text-[var(--color-primary)]">{row.orderNumber}</div>
            {deferredTrackedOrder && pendingSessionMatchesOrder(row, deferredTrackedOrder) ? (
              <Tag color="gold">Đang theo dõi</Tag>
            ) : null}
          </div>
          <div className="text-xs text-[var(--color-secondary)]">
            {row.receivedItems} / {row.totalItems} phản hồi
          </div>
        </div>
      ),
    },
    {
      title: "Trạng thái",
      width: 150,
      render: (_, row) =>
        row.failed ? <Tag color="red">Item lỗi</Tag> : <Tag color="gold">Đang chờ</Tag>,
    },
    {
      title: "Tuổi phiên",
      width: 120,
      render: (_, row) => formatDurationMs(row.ageMs),
    },
    {
      title: "Hết hạn",
      width: 170,
      render: (_, row) => formatMillis(row.expiresAtMs),
    },
  ];

  const previewKafkaRecord = matchedKafkaRows[0] || kafkaRecordsQuery.data?.[0];

  const renderWorkflowSection = () => (
    <div className="space-y-4">
      <Row gutter={[16, 16]}>
        <Col xs={24}>
          <WorkflowTimelinePanel
            trackedOrderNumber={deferredTrackedOrder}
            order={focusedOrder}
            orderLoading={trackedOrderDetailQuery.isLoading}
            orderError={trackedOrderDetailQuery.isError}
            relatedSaga={focusedSaga}
            pendingSession={focusedPendingSession}
            hasSagaSnapshot={sagaCatalog.length > 0}
            onTrackedSkuChange={handleTrackedSkuChange}
          />
        </Col>
      </Row>
    </div>
  );

  const renderFailureSection = () => (
    <Card className="app-admin-card border-0" title="Lỗi & Bù trừ">
      {sagaQuery.isLoading ? (
        <div className="flex min-h-[240px] items-center justify-center">
          <Spin />
        </div>
      ) : sagaQuery.isError ? (
        <Alert type="warning" showIcon message="Không tải được Saga snapshot" />
      ) : sagaQuery.data ? (
        <div className="space-y-4">
          <Row gutter={[16, 16]}>
            <Col xs={12} md={6}>
              <div className="rounded-[22px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Đang hoạt động</div>
                <div className="mt-2 text-2xl font-semibold">{sagaSummary.active}</div>
              </div>
            </Col>
            <Col xs={12} md={6}>
              <div className="rounded-[22px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Lỗi</div>
                <div className="mt-2 text-2xl font-semibold">{sagaSummary.failed}</div>
              </div>
            </Col>
            <Col xs={12} md={6}>
              <div className="rounded-[22px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Quá hạn</div>
                <div className="mt-2 text-2xl font-semibold">{sagaQuery.data.timeoutSummary.overdueCount}</div>
              </div>
            </Col>
            <Col xs={12} md={6}>
              <div className="rounded-[22px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Bridge đang chờ</div>
                <div className="mt-2 text-2xl font-semibold">{sagaQuery.data.aggregator.pendingCount}</div>
              </div>
            </Col>
          </Row>

          <Descriptions column={{ xs: 1, xl: 2 }} size="small" bordered>
            <Descriptions.Item label="Saga khởi động từ boot">
              {sagaQuery.data.runtimeCounters.sagaStartedSinceBoot}
            </Descriptions.Item>
            <Descriptions.Item label="Saga hoàn tất / bù trừ">
              {sagaQuery.data.runtimeCounters.sagaCompletedSinceBoot +
                sagaQuery.data.runtimeCounters.sagaCompensatedSinceBoot}
            </Descriptions.Item>
            <Descriptions.Item label="Đã timeout">{sagaQuery.data.timeoutSummary.timedOutCount}</Descriptions.Item>
            <Descriptions.Item label="Bù trừ thất bại">
              {sagaQuery.data.timeoutSummary.compensationFailedCount}
            </Descriptions.Item>
            <Descriptions.Item label="Bridge trùng bị bỏ qua">
              {sagaQuery.data.aggregator.duplicateStartsIgnoredSinceBoot}
            </Descriptions.Item>
            <Descriptions.Item label="Phản hồi muộn bị bỏ qua">
              {sagaQuery.data.aggregator.lateResultsIgnoredSinceBoot}
            </Descriptions.Item>
          </Descriptions>

          {(focusedSaga || focusedPendingSession || deferredTrackedOrder) ? (
            <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4">
              <div className="text-sm font-semibold text-amber-900">Tập trung theo đơn đang theo dõi</div>
              <div className="mt-2 space-y-2 text-sm leading-7 text-amber-900/80">
                <div>
                  <span className="font-medium text-amber-950">Đơn hàng:</span>{" "}
                  {deferredTrackedOrder || "chưa chọn"}
                </div>
                <div>
                  <span className="font-medium text-amber-950">Saga khớp:</span>{" "}
                  {focusedSaga ? focusedSaga.sagaId : "Chưa thấy Saga khớp trong snapshot hiện tại"}
                </div>
                {focusedSaga?.failureReason ? (
                  <div>
                    <span className="font-medium text-amber-950">Lý do gần nhất:</span>{" "}
                    {focusedSaga.failureReason}
                  </div>
                ) : null}
                <div>
                  <span className="font-medium text-amber-950">Bridge đang chờ:</span>{" "}
                  {focusedPendingSession
                    ? `${focusedPendingSession.receivedItems}/${focusedPendingSession.totalItems} phản hồi`
                    : "Không có bridge đang chờ trong snapshot hiện tại"}
                </div>
              </div>
            </div>
          ) : null}

          <Row gutter={[16, 16]}>
            <Col xs={24} xl={12}>
              <div className="rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-4">
                <div className="mb-3 text-sm font-semibold text-[var(--color-primary)]">
                  {deferredTrackedOrder ? "Lỗi của đơn đang theo dõi" : "Lỗi gần đây"}
                </div>
                {filteredRecentFailures.length === 0 ? (
                  <Empty
                    description={
                      deferredTrackedOrder
                        ? "Đơn đang theo dõi chưa có Saga lỗi hoặc timeout trong snapshot hiện tại"
                        : "Chưa có Saga lỗi hoặc timeout"
                    }
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                ) : (
                  <Table
                    rowKey={(row) => `failure-${row.sagaId}`}
                    columns={sagaColumns}
                    dataSource={filteredRecentFailures}
                    pagination={false}
                    size="small"
                    scroll={{ x: 680 }}
                    rowClassName={(row) => (matchedSagaIds.has(row.sagaId) ? "framework-demo-row-active" : "")}
                  />
                )}
              </div>
            </Col>
            <Col xs={24} xl={12}>
              <div className="rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-4">
                <div className="mb-3 text-sm font-semibold text-[var(--color-primary)]">
                  {deferredTrackedOrder ? "Bù trừ của đơn đang theo dõi" : "Bù trừ gần đây"}
                </div>
                {filteredRecentCompensations.length === 0 ? (
                  <Empty
                    description={
                      deferredTrackedOrder
                        ? "Đơn đang theo dõi chưa có Saga bù trừ trong snapshot hiện tại"
                        : "Chưa ghi nhận bù trừ nào"
                    }
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                ) : (
                  <Table
                    rowKey={(row) => `comp-${row.sagaId}`}
                    columns={sagaColumns}
                    dataSource={filteredRecentCompensations}
                    pagination={false}
                    size="small"
                    scroll={{ x: 680 }}
                    rowClassName={(row) => (matchedSagaIds.has(row.sagaId) ? "framework-demo-row-active" : "")}
                  />
                )}
              </div>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} xl={12}>
              <div className="rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-4">
                <div className="mb-3 text-sm font-semibold text-[var(--color-primary)]">
                  {deferredTrackedOrder ? "Dấu hiệu quá hạn của đơn đang theo dõi" : "Dấu hiệu quá hạn / mắc kẹt"}
                </div>
                {filteredOverdueInstances.length === 0 ? (
                  <Empty
                    description={
                      deferredTrackedOrder
                        ? "Đơn đang theo dõi không có Saga quá hạn trong snapshot hiện tại"
                        : "Không có Saga instance quá hạn"
                    }
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                ) : (
                  <Table
                    rowKey={(row) => `overdue-${row.sagaId}`}
                    columns={sagaColumns}
                    dataSource={filteredOverdueInstances}
                    pagination={false}
                    size="small"
                    scroll={{ x: 680 }}
                    rowClassName={(row) => (matchedSagaIds.has(row.sagaId) ? "framework-demo-row-active" : "")}
                  />
                )}
              </div>
            </Col>
            <Col xs={24} xl={12}>
              <div className="rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-4">
                <div className="mb-3 text-sm font-semibold text-[var(--color-primary)]">
                  {deferredTrackedOrder ? "Bridge của đơn đang theo dõi" : "Bridge inventory đang chờ"}
                </div>
                {filteredPendingSessions.length === 0 ? (
                  <Empty
                    description={
                      deferredTrackedOrder
                        ? "Đơn đang theo dõi không có phiên bridge đang chờ trong snapshot hiện tại"
                        : "Không có phiên bridge đang chờ"
                    }
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                ) : (
                  <Table
                    rowKey={(row) => `bridge-${row.orderNumber}`}
                    columns={pendingSessionColumns}
                    dataSource={filteredPendingSessions}
                    pagination={false}
                    size="small"
                    scroll={{ x: 680 }}
                    rowClassName={(row) =>
                      deferredTrackedOrder && pendingSessionMatchesOrder(row, deferredTrackedOrder)
                        ? "framework-demo-row-active"
                        : ""
                    }
                  />
                )}
              </div>
            </Col>
          </Row>
        </div>
      ) : (
        <Empty description="Saga snapshot đang trống" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}
    </Card>
  );

  const renderReservationSection = () => (
    <ReservationEvidencePanel
      trackedSku={effectiveSku}
      availability={availabilityQuery.data}
      loading={availabilityQuery.isLoading}
      error={availabilityQuery.isError}
      quickSkuOptions={focusedOrderSkuOptions}
      onTrackedSkuChange={handleTrackedSkuChange}
    />
  );

  const renderOutboxSection = () => (
    <div className="space-y-4">
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <div className="rounded-[24px] border border-[var(--color-border)] bg-white px-5 py-5 shadow-[var(--shadow-soft)]">
            <div className="flex items-center gap-3">
              <DatabaseOutlined className="text-lg text-[var(--color-primary)]" />
              <div className="text-sm font-semibold text-[var(--color-primary)]">Dòng outbox</div>
            </div>
            <div className="mt-4 text-3xl font-semibold text-[var(--color-primary)]">
              {outboxQuery.data?.length || 0}
            </div>
            <div className="mt-2 text-sm text-[var(--color-secondary)]">
              {outboxFilter
                ? `Message key thủ công: ${outboxFilter}`
                : deferredTrackedOrder
                  ? `Đang bám order và SKU trong đơn ${deferredTrackedOrder}`
                  : "Các dòng gần đây từ /api/system/outbox"}
            </div>
          </div>
        </Col>
        <Col xs={24} md={8}>
          <div className="rounded-[24px] border border-[var(--color-border)] bg-white px-5 py-5 shadow-[var(--shadow-soft)]">
            <div className="flex items-center gap-3">
              <ApiOutlined className="text-lg text-[var(--color-primary)]" />
              <div className="text-sm font-semibold text-[var(--color-primary)]">Trạng thái publish</div>
            </div>
            <div className="mt-4 text-3xl font-semibold text-[var(--color-primary)]">{outboxHealth.sent}</div>
            <div className="mt-2 text-sm text-[var(--color-secondary)]">
              SENT / {outboxHealth.retrying} đang retry / {outboxHealth.failed} lỗi
            </div>
          </div>
        </Col>
        <Col xs={24} md={8}>
          <div className="rounded-[24px] border border-[var(--color-border)] bg-white px-5 py-5 shadow-[var(--shadow-soft)]">
            <div className="flex items-center gap-3">
              <LineChartOutlined className="text-lg text-[var(--color-primary)]" />
              <div className="text-sm font-semibold text-[var(--color-primary)]">Kafka / DLQ</div>
            </div>
            <div className="mt-4 text-3xl font-semibold text-[var(--color-primary)]">
              {matchedKafkaRows.length}
            </div>
            <div className="mt-2 text-sm text-[var(--color-secondary)]">
              {effectiveKafkaTopic ? `Trong topic ${effectiveKafkaTopic}` : "Trong topic đang xem"}
            </div>
          </div>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={13}>
          <Card className="app-admin-card border-0" title="Outbox">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {deferredTrackedOrder ? (
                  <Tag color={outboxFilter ? "default" : "gold"}>Order đang bám: {deferredTrackedOrder}</Tag>
                ) : null}
                {!outboxFilter && focusedOrderSkuOptions.length > 0 ? (
                  <Tag color="cyan">SKU trong đơn: {focusedOrderSkuOptions.join(", ")}</Tag>
                ) : null}
                {outboxFilter ? <Tag color="blue">Message key thủ công: {outboxFilter}</Tag> : null}
                {deferredTrackedOrder ? (
                  <Button size="small" onClick={resetOutboxManualFilter}>
                    Dùng lại order đang theo dõi
                  </Button>
                ) : null}
                {outboxFilter ? (
                  <Button size="small" onClick={resetOutboxManualFilter}>
                    Bỏ lọc tay
                  </Button>
                ) : null}
              </div>

              <Space.Compact className="w-full">
                <Input
                  value={outboxInput}
                  placeholder="Nhập message key để lọc nhanh"
                  onChange={(event) => setOutboxInput(event.target.value)}
                  onPressEnter={() => applyOutboxFilter(outboxInput)}
                />
                <Button
                  type="primary"
                  className="!bg-[var(--color-primary)]"
                  onClick={() => applyOutboxFilter(outboxInput)}
                >
                  Áp dụng
                </Button>
                <Button onClick={resetOutboxManualFilter}>
                  Đặt lại
                </Button>
              </Space.Compact>

              {outboxQuery.isLoading ? (
                <div className="flex min-h-[220px] items-center justify-center">
                  <Spin />
                </div>
              ) : outboxQuery.isError ? (
                <Alert type="warning" showIcon message="Đường dẫn outbox admin chưa truy cập được" />
              ) : (outboxQuery.data || []).length === 0 ? (
                <Empty
                  description={
                    effectiveOutboxFilter || deferredTrackedOrder
                      ? "Chưa thấy dòng outbox nào khớp với trọng tâm hiện tại"
                      : "Outbox admin đang sẵn sàng nhưng chưa có dòng nào"
                  }
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ) : (
                <Table
                  rowKey={(row) => `${row.id}-${row.eventId}`}
                  columns={outboxColumns}
                  dataSource={outboxQuery.data}
                  pagination={false}
                  size="small"
                  scroll={{ x: 760 }}
                  rowClassName={(row) => (outboxRowMatchesFocus(row) ? "framework-demo-row-active" : "")}
                  expandable={{
                    expandedRowRender: (row) => (
                      <div className="space-y-2 text-sm text-[var(--color-secondary)]">
                        <div>
                          <span className="font-medium text-[var(--color-primary)]">Event ID:</span>{" "}
                          {row.eventId}
                        </div>
                        <div>
                          <span className="font-medium text-[var(--color-primary)]">Đã gửi:</span>{" "}
                          {row.sentAt ? formatDateTimeWithRelative(row.sentAt) : "Chưa gửi"}
                        </div>
                        <div>
                          <span className="font-medium text-[var(--color-primary)]">Số lần retry:</span>{" "}
                          {row.retryCount}
                        </div>
                        <div>
                          <span className="font-medium text-[var(--color-primary)]">Lần thử tiếp theo:</span>{" "}
                          {formatDateTimeWithRelative(row.nextAttemptAt)}
                        </div>
                        <div>
                          <span className="font-medium text-[var(--color-primary)]">Lỗi gần nhất:</span>{" "}
                          {row.lastError || "—"}
                        </div>
                        {row.msgKey ? (
                          <Button size="small" onClick={() => applyOutboxFilter(row.msgKey)}>
                            Lọc theo message key này
                          </Button>
                        ) : null}
                      </div>
                    ),
                    rowExpandable: (row) => Boolean(row.lastError || row.nextAttemptAt || row.retryCount),
                  }}
                />
              )}
            </div>
          </Card>
        </Col>

        <Col xs={24} xl={11}>
          <Card className="app-admin-card border-0" title="Kafka Admin / DLQ">
            <div className="space-y-4">
              {kafkaIndexQuery.isError ? (
                <Alert type="warning" showIcon message="Không tải được chỉ mục Kafka Admin" />
              ) : kafkaIndexQuery.data ? (
                <div className="flex flex-wrap gap-2">
                  <Tag>{kafkaIndexQuery.data.service}</Tag>
                  <Tag>{kafkaIndexQuery.data.basePath}</Tag>
                </div>
              ) : null}

              <Select
                value={effectiveKafkaTopic || undefined}
                options={kafkaTopicOptions}
                onChange={handleKafkaTopicChange}
                onClear={() => handleKafkaTopicChange(undefined)}
                placeholder="Chọn topic DLQ"
                allowClear
                showSearch
                className="w-full"
                filterOption={(inputValue, option) =>
                  String(option?.value || "")
                    .toUpperCase()
                    .includes(inputValue.toUpperCase())
                }
              />

              {(kafkaTopicsQuery.data || []).length === 0 &&
              !kafkaTopicsQuery.isLoading &&
              !kafkaTopicsQuery.isError ? (
                <Empty description="Kafka Admin chưa báo topic DLQ nào" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : null}

              {effectiveKafkaTopic ? (
                <div className="flex flex-wrap gap-2">
                  <Tag color="blue">Topic đang xem: {effectiveKafkaTopic}</Tag>
                  {deferredTrackedOrder ? (
                    <Tag color={matchedKafkaRows.length > 0 ? "gold" : "default"}>
                      Khớp order đang theo dõi: {matchedKafkaRows.length}
                    </Tag>
                  ) : null}
                </div>
              ) : null}

              {effectiveKafkaTopic ? (
                <Table
                  rowKey={(row) => `${row.topic}-${row.partition}-${row.offset}`}
                  loading={kafkaRecordsQuery.isLoading}
                  columns={kafkaColumns}
                  dataSource={kafkaRecordsQuery.data || []}
                  pagination={false}
                  size="small"
                  scroll={{ x: 760 }}
                  rowClassName={(row) =>
                    deferredTrackedOrder && kafkaRecordMatchesOrder(row, deferredTrackedOrder)
                      ? "framework-demo-row-active"
                      : ""
                  }
                  expandable={{
                    expandedRowRender: (row) => (
                      <div className="space-y-2 text-sm text-[var(--color-secondary)]">
                        <div>
                          <span className="font-medium text-[var(--color-primary)]">Key:</span>{" "}
                          {row.key || "—"}
                        </div>
                        <div>
                          <span className="font-medium text-[var(--color-primary)]">Correlation:</span>{" "}
                          {row.correlationId || "—"}
                        </div>
                        <div>
                          <span className="font-medium text-[var(--color-primary)]">Request ID:</span>{" "}
                          {row.requestId || "—"}
                        </div>
                        <div>
                          <span className="font-medium text-[var(--color-primary)]">Event ID:</span>{" "}
                          {row.eventId || "—"}
                        </div>
                      </div>
                    ),
                    rowExpandable: (row) =>
                      Boolean(row.key || row.correlationId || row.requestId || row.eventId),
                  }}
                />
              ) : null}

              {previewKafkaRecord ? (
                <Collapse
                  size="small"
                  items={[
                    {
                      key: "payload",
                      label: matchedKafkaRows[0]
                        ? "Xem payload bản ghi đang theo dõi"
                        : "Xem payload bản ghi mẫu",
                      children: (
                        <pre className="max-h-[220px] overflow-auto rounded-[18px] bg-[#111827] px-4 py-4 text-[11px] leading-6 text-white/82">
                          {JSON.stringify(previewKafkaRecord.value, null, 2)}
                        </pre>
                      ),
                    },
                  ]}
                />
              ) : null}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );

  const renderRuntimeSection = () => (
    <div className="space-y-4">
      <Card
        className="app-admin-card border-0"
        title="Runtime"
        extra={
          runtimeSummary.total > 0 ? (
            <Tag color={runtimeSummary.healthy === runtimeSummary.total ? "green" : "gold"}>
              {runtimeSummary.healthy}/{runtimeSummary.total} dịch vụ khỏe
            </Tag>
          ) : null
        }
      >
        {runtimeQuery.isLoading ? (
          <div className="flex min-h-[240px] items-center justify-center">
            <Spin />
          </div>
        ) : runtimeQuery.isError ? (
          <Alert type="warning" showIcon message="Các tín hiệu Runtime hiện chưa truy cập được" />
        ) : (runtimeQuery.data || []).length === 0 ? (
          <Empty description="Chưa có snapshot Runtime" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <div className="space-y-4">
            <Row gutter={[16, 16]}>
              {(runtimeQuery.data || []).map((service) => (
                <Col xs={24} md={12} xl={8} key={service.key}>
                  <div className="h-full rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-5 py-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-semibold text-[var(--color-primary)]">{service.label}</div>
                        <div className="text-sm text-[var(--color-secondary)]">{service.role}</div>
                      </div>
                      {healthTag(service.healthStatus)}
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-[18px] bg-white px-3 py-3">
                        <div className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">Chỉ số</div>
                        <div className="mt-1 text-xl font-semibold">{service.metricsCount}</div>
                      </div>
                      <div className="rounded-[18px] bg-white px-3 py-3">
                        <div className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">Prometheus</div>
                        <div className="mt-1 text-xl font-semibold">
                          {service.prometheusAvailable ? service.prometheusSeriesCount : "—"}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      {service.keyMetrics.length > 0 ? (
                        service.keyMetrics.map((metric) => (
                          <div
                            key={metric.name}
                            className="flex items-center justify-between rounded-[16px] bg-white px-3 py-2 text-sm"
                          >
                            <span className="text-[var(--color-secondary)]">{metric.label}</span>
                            <span className="font-semibold text-[var(--color-primary)]">
                              {formatMetric(metric)}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-[16px] bg-white px-3 py-3 text-sm text-[var(--color-secondary)]">
                          Chưa có chỉ số tuyển chọn.
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {service.components.length > 0 ? (
                        service.components.map((component) => <Tag key={component}>{component}</Tag>)
                      ) : (
                        <Tag>Không có chi tiết component</Tag>
                      )}
                    </div>
                  </div>
                </Col>
              ))}
            </Row>

            <div className="rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)]">
                <LinkOutlined />
                Liên kết vận hành
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {systemLinks.map((item) => (
                  <a
                    key={item.key}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center rounded-full border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-medium text-[var(--color-primary)] transition hover:border-[var(--color-primary)]"
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );

  const activeSectionContent = (() => {
    if (activeSection === "workflow") return renderWorkflowSection();
    if (activeSection === "failure") return renderFailureSection();
    if (activeSection === "reservation") return renderReservationSection();
    if (activeSection === "outbox") return renderOutboxSection();
    return renderRuntimeSection();
  })();

  return (
    <div className="space-y-6">
      <DemoConsoleHeader
        activeSection={activeSection}
        sections={frameworkSections}
        trackedOrderNumber={trackedOrderNumber}
        orderOptions={orderOptions}
        trackedSku={displayedTrackedSku}
        skuOptions={skuOptions}
        lockTrackedSku={focusedOrderSkuOptions.length > 0}
        onSectionChange={handleSectionChange}
        onTrackedOrderChange={handleTrackedOrderChange}
        onTrackedSkuChange={handleTrackedSkuChange}
        onRefreshAll={refreshAll}
      />

      {activeSectionContent}
    </div>
  );
}
