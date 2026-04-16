import axiosClient from "@/lib/axiosClient";
import {
  isRecord,
  readBoolean,
  readNumber,
  readString,
  readStringArray,
  unwrapCollection,
} from "@/lib/api-normalizers";
import { productApi } from "@/services/productApi";
import type { ProductVariant } from "@/types";

export interface VisibilitySkuOption {
  skuCode: string;
  label: string;
  productName?: string;
  color?: string;
  size?: string;
}

export interface OutboxVisibilityRow {
  id: number;
  topic: string;
  msgKey?: string;
  eventId: string;
  eventType: string;
  status: string;
  retryCount: number;
  createdAt?: string;
  sentAt?: string;
  nextAttemptAt?: string;
  leaseUntil?: string;
  leaseOwner?: string;
  lastError?: string;
}

export interface KafkaAdminIndex {
  service: string;
  basePath: string;
  routes: Record<string, string>;
}

export interface SagaInstanceView {
  sagaId: string;
  definitionName: string;
  status: string;
  phase: string;
  currentStep?: string;
  correlationId?: string;
  failureReason?: string;
  nextTimeoutAtMs?: number;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface SagaTimeoutSummary {
  timedOutCount: number;
  compensationFailedCount: number;
  overdueCount: number;
}

export interface SagaPendingSessionView {
  orderNumber: string;
  totalItems: number;
  receivedItems: number;
  failed: boolean;
  failureReason?: string;
  createdAtMs: number;
  updatedAtMs: number;
  expiresAtMs: number;
  ageMs: number;
}

export interface SagaAggregatorSnapshot {
  pendingCount: number;
  duplicateStartsIgnoredSinceBoot: number;
  lateResultsIgnoredSinceBoot: number;
  expiredSinceBoot: number;
  pendingSessions: SagaPendingSessionView[];
}

export interface SagaRuntimeCounters {
  legacyStartsSinceBoot: number;
  sagaModeStartsSinceBoot: number;
  sagaStartedSinceBoot: number;
  sagaCompletedSinceBoot: number;
  sagaFailedSinceBoot: number;
  sagaCompensatedSinceBoot: number;
  aggregatorDuplicateStartsIgnoredSinceBoot: number;
  aggregatorLateResultsIgnoredSinceBoot: number;
  aggregatorExpiredSinceBoot: number;
}

export interface SagaAdminSnapshot {
  workflowMode: string;
  defaultWorkflowMode: string;
  rollbackWorkflowMode: string;
  rollbackAvailable: boolean;
  sagaEnabled: boolean;
  storeMode: string;
  transportMode: string;
  summary: Record<string, number>;
  timeoutSummary: SagaTimeoutSummary;
  aggregator: SagaAggregatorSnapshot;
  runtimeCounters: SagaRuntimeCounters;
  recentInstances: SagaInstanceView[];
  recentFailures: SagaInstanceView[];
  recentCompensations: SagaInstanceView[];
  overdueInstances: SagaInstanceView[];
}

export interface KafkaDlqRecord {
  topic: string;
  partition: number;
  offset: number;
  timestamp?: string;
  key?: string;
  originalTopic?: string;
  originalPartition?: number;
  originalOffset?: number;
  eventId?: string;
  eventType?: string;
  correlationId?: string;
  causationId?: string;
  requestId?: string;
  producer?: string;
  reason?: string;
  nonRetryable: boolean;
  exceptionClass?: string;
  exceptionMessage?: string;
  headers: Record<string, string>;
  value?: unknown;
}

export interface RuntimeMetricSnapshot {
  name: string;
  label: string;
  statistic: string;
  value: number | null;
  baseUnit?: string;
}

export interface RuntimeServiceSnapshot {
  key: string;
  label: string;
  role: string;
  healthStatus: string;
  healthAvailable: boolean;
  components: string[];
  metricsIndexAvailable: boolean;
  metricsCount: number;
  prometheusAvailable: boolean;
  prometheusSeriesCount: number;
  prometheusPreview: string[];
  keyMetrics: RuntimeMetricSnapshot[];
  notes?: string;
}

interface RuntimeServiceConfig {
  key: string;
  label: string;
  role: string;
  basePath: string;
  metrics: Array<{ name: string; label: string }>;
}

const runtimeServiceConfigs: RuntimeServiceConfig[] = [
  {
    key: "gateway",
    label: "Cổng API",
    role: "định tuyến biên",
    basePath: "/ops/gateway",
    metrics: [
      { name: "process.uptime", label: "Thời gian chạy tiến trình" },
      { name: "jvm.threads.live", label: "Số luồng đang chạy" },
      { name: "http.server.requests", label: "Số request HTTP" },
    ],
  },
  {
    key: "order",
    label: "Dịch vụ đơn hàng",
    role: "điều phối workflow",
    basePath: "/ops/order",
    metrics: [
      { name: "orders_processed_total", label: "Số đơn đã xử lý" },
      { name: "lsf.order.workflow.starts", label: "Số lần khởi chạy workflow" },
      { name: "lsf.order.saga.instances", label: "Số saga instance" },
      { name: "lsf.order.saga.aggregator.pending", label: "Số bridge đang chờ" },
    ],
  },
  {
    key: "product",
    label: "Dịch vụ sản phẩm",
    role: "danh mục + raw outbox bridge",
    basePath: "/ops/product",
    metrics: [
      { name: "lsf.outbox.pending", label: "Outbox đang chờ" },
      { name: "lsf.outbox.sent", label: "Outbox đã gửi" },
      { name: "lsf.outbox.fail", label: "Outbox lỗi" },
    ],
  },
  {
    key: "cart",
    label: "Dịch vụ giỏ hàng",
    role: "dọn dẹp checkout + cache",
    basePath: "/ops/cart",
    metrics: [
      { name: "jvm.threads.live", label: "Số luồng đang chạy" },
      { name: "process.uptime", label: "Thời gian chạy tiến trình" },
      { name: "system.cpu.usage", label: "Mức dùng CPU" },
    ],
  },
  {
    key: "inventory",
    label: "Dịch vụ tồn kho",
    role: "hiển thị reservation",
    basePath: "/ops/inventory",
    metrics: [
      { name: "jvm.threads.live", label: "Số luồng đang chạy" },
      { name: "process.uptime", label: "Thời gian chạy tiến trình" },
      { name: "system.cpu.usage", label: "Mức dùng CPU" },
    ],
  },
];

function normalizeOutboxRow(payload: unknown): OutboxVisibilityRow {
  if (!isRecord(payload)) {
    return {
      id: 0,
      topic: "",
      eventId: "",
      eventType: "",
      status: "UNKNOWN",
      retryCount: 0,
    };
  }

  return {
    id: readNumber(payload.id),
    topic: readString(payload.topic),
    msgKey: readString(payload.msgKey || payload.key),
    eventId: readString(payload.eventId),
    eventType: readString(payload.eventType),
    status: readString(payload.status, "UNKNOWN").toUpperCase(),
    retryCount: readNumber(payload.retryCount),
    createdAt: readString(payload.createdAt),
    sentAt: readString(payload.sentAt),
    nextAttemptAt: readString(payload.nextAttemptAt),
    leaseUntil: readString(payload.leaseUntil),
    leaseOwner: readString(payload.leaseOwner),
    lastError: readString(payload.lastError),
  };
}

function normalizeKafkaAdminIndex(payload: unknown): KafkaAdminIndex {
  const routes =
    isRecord(payload) && isRecord(payload.routes)
      ? Object.fromEntries(
          Object.entries(payload.routes).map(([key, value]) => [
            key,
            readString(value),
          ]),
        )
      : {};

  return {
    service: isRecord(payload) ? readString(payload.service, "unknown") : "unknown",
    basePath: isRecord(payload) ? readString(payload.basePath, "/api/system/kafka") : "/api/system/kafka",
    routes,
  };
}

function normalizeSagaInstance(payload: unknown): SagaInstanceView {
  if (!isRecord(payload)) {
    return {
      sagaId: "",
      definitionName: "",
      status: "UNKNOWN",
      phase: "UNKNOWN",
      createdAtMs: 0,
      updatedAtMs: 0,
    };
  }

  return {
    sagaId: readString(payload.sagaId),
    definitionName: readString(payload.definitionName),
    status: readString(payload.status, "UNKNOWN").toUpperCase(),
    phase: readString(payload.phase, "UNKNOWN").toUpperCase(),
    currentStep: readString(payload.currentStep),
    correlationId: readString(payload.correlationId),
    failureReason: readString(payload.failureReason),
    nextTimeoutAtMs:
      isRecord(payload) && payload.nextTimeoutAtMs != null
        ? readNumber(payload.nextTimeoutAtMs)
        : undefined,
    createdAtMs: readNumber(payload.createdAtMs),
    updatedAtMs: readNumber(payload.updatedAtMs),
  };
}

function normalizeSagaTimeoutSummary(payload: unknown): SagaTimeoutSummary {
  return {
    timedOutCount: isRecord(payload) ? readNumber(payload.timedOutCount) : 0,
    compensationFailedCount: isRecord(payload)
      ? readNumber(payload.compensationFailedCount)
      : 0,
    overdueCount: isRecord(payload) ? readNumber(payload.overdueCount) : 0,
  };
}

function normalizeSagaPendingSession(payload: unknown): SagaPendingSessionView {
  if (!isRecord(payload)) {
    return {
      orderNumber: "",
      totalItems: 0,
      receivedItems: 0,
      failed: false,
      createdAtMs: 0,
      updatedAtMs: 0,
      expiresAtMs: 0,
      ageMs: 0,
    };
  }

  return {
    orderNumber: readString(payload.orderNumber),
    totalItems: readNumber(payload.totalItems),
    receivedItems: readNumber(payload.receivedItems),
    failed: readBoolean(payload.failed),
    failureReason: readString(payload.failureReason),
    createdAtMs: readNumber(payload.createdAtMs),
    updatedAtMs: readNumber(payload.updatedAtMs),
    expiresAtMs: readNumber(payload.expiresAtMs),
    ageMs: readNumber(payload.ageMs),
  };
}

function normalizeSagaAggregatorSnapshot(payload: unknown): SagaAggregatorSnapshot {
  return {
    pendingCount: isRecord(payload) ? readNumber(payload.pendingCount) : 0,
    duplicateStartsIgnoredSinceBoot: isRecord(payload)
      ? readNumber(payload.duplicateStartsIgnoredSinceBoot)
      : 0,
    lateResultsIgnoredSinceBoot: isRecord(payload)
      ? readNumber(payload.lateResultsIgnoredSinceBoot)
      : 0,
    expiredSinceBoot: isRecord(payload) ? readNumber(payload.expiredSinceBoot) : 0,
    pendingSessions: unwrapCollection<unknown>(payload, ["pendingSessions", "items", "content"])
      .map(normalizeSagaPendingSession)
      .filter((item) => item.orderNumber),
  };
}

function normalizeSagaRuntimeCounters(payload: unknown): SagaRuntimeCounters {
  return {
    legacyStartsSinceBoot: isRecord(payload) ? readNumber(payload.legacyStartsSinceBoot) : 0,
    sagaModeStartsSinceBoot: isRecord(payload) ? readNumber(payload.sagaModeStartsSinceBoot) : 0,
    sagaStartedSinceBoot: isRecord(payload) ? readNumber(payload.sagaStartedSinceBoot) : 0,
    sagaCompletedSinceBoot: isRecord(payload) ? readNumber(payload.sagaCompletedSinceBoot) : 0,
    sagaFailedSinceBoot: isRecord(payload) ? readNumber(payload.sagaFailedSinceBoot) : 0,
    sagaCompensatedSinceBoot: isRecord(payload)
      ? readNumber(payload.sagaCompensatedSinceBoot)
      : 0,
    aggregatorDuplicateStartsIgnoredSinceBoot: isRecord(payload)
      ? readNumber(payload.aggregatorDuplicateStartsIgnoredSinceBoot)
      : 0,
    aggregatorLateResultsIgnoredSinceBoot: isRecord(payload)
      ? readNumber(payload.aggregatorLateResultsIgnoredSinceBoot)
      : 0,
    aggregatorExpiredSinceBoot: isRecord(payload)
      ? readNumber(payload.aggregatorExpiredSinceBoot)
      : 0,
  };
}

function normalizeSagaSnapshot(payload: unknown): SagaAdminSnapshot {
  const summary =
    isRecord(payload) && isRecord(payload.summary)
      ? Object.fromEntries(
          Object.entries(payload.summary).map(([key, value]) => [key, readNumber(value)]),
        )
      : {};

  return {
    workflowMode: isRecord(payload) ? readString(payload.workflowMode, "UNKNOWN") : "UNKNOWN",
    defaultWorkflowMode: isRecord(payload)
      ? readString(payload.defaultWorkflowMode, readString(payload.workflowMode, "UNKNOWN"))
      : "UNKNOWN",
    rollbackWorkflowMode: isRecord(payload)
      ? readString(payload.rollbackWorkflowMode, "LEGACY")
      : "LEGACY",
    rollbackAvailable: isRecord(payload) ? readBoolean(payload.rollbackAvailable, true) : true,
    sagaEnabled: isRecord(payload) ? readBoolean(payload.sagaEnabled) : false,
    storeMode: isRecord(payload) ? readString(payload.storeMode, "UNKNOWN") : "UNKNOWN",
    transportMode: isRecord(payload) ? readString(payload.transportMode, "UNKNOWN") : "UNKNOWN",
    summary,
    timeoutSummary: normalizeSagaTimeoutSummary(isRecord(payload) ? payload.timeoutSummary : null),
    aggregator: normalizeSagaAggregatorSnapshot(isRecord(payload) ? payload.aggregator : null),
    runtimeCounters: normalizeSagaRuntimeCounters(
      isRecord(payload) ? payload.runtimeCounters : null,
    ),
    recentInstances: unwrapCollection<unknown>(payload, ["recentInstances", "items", "content"])
      .map(normalizeSagaInstance)
      .filter((item) => item.sagaId),
    recentFailures: unwrapCollection<unknown>(payload, ["recentFailures", "items", "content"])
      .map(normalizeSagaInstance)
      .filter((item) => item.sagaId),
    recentCompensations: unwrapCollection<unknown>(
      payload,
      ["recentCompensations", "items", "content"],
    )
      .map(normalizeSagaInstance)
      .filter((item) => item.sagaId),
    overdueInstances: unwrapCollection<unknown>(payload, ["overdueInstances", "items", "content"])
      .map(normalizeSagaInstance)
      .filter((item) => item.sagaId),
  };
}

function normalizeKafkaDlqRecord(payload: unknown): KafkaDlqRecord {
  if (!isRecord(payload)) {
    return {
      topic: "",
      partition: 0,
      offset: 0,
      nonRetryable: false,
      headers: {},
    };
  }

  const headers =
    isRecord(payload.headers)
      ? Object.fromEntries(
          Object.entries(payload.headers).map(([key, value]) => [key, readString(value)]),
        )
      : {};

  return {
    topic: readString(payload.topic),
    partition: readNumber(payload.partition),
    offset: readNumber(payload.offset),
    timestamp: readString(payload.timestamp),
    key: readString(payload.key),
    originalTopic: readString(payload.originalTopic),
    originalPartition: payload.originalPartition == null ? undefined : readNumber(payload.originalPartition),
    originalOffset: payload.originalOffset == null ? undefined : readNumber(payload.originalOffset),
    eventId: readString(payload.eventId),
    eventType: readString(payload.eventType),
    correlationId: readString(payload.correlationId),
    causationId: readString(payload.causationId),
    requestId: readString(payload.requestId),
    producer: readString(payload.producer),
    reason: readString(payload.reason),
    nonRetryable: payload.nonRetryable === true,
    exceptionClass: readString(payload.exceptionClass),
    exceptionMessage: readString(payload.exceptionMessage),
    headers,
    value: payload.value,
  };
}

function pickMeasurement(payload: unknown): {
  statistic: string;
  value: number | null;
} {
  const measurements = unwrapCollection<unknown>(payload, ["measurements"]);
  const normalized = measurements
    .filter(isRecord)
    .map((item) => ({
      statistic: readString(item.statistic, "VALUE"),
      value: typeof item.value === "number" ? item.value : null,
    }));

  if (normalized.length === 0) {
    return { statistic: "VALUE", value: null };
  }

  const preferredOrder = ["COUNT", "VALUE", "TOTAL", "MAX"];
  for (const statistic of preferredOrder) {
    const match = normalized.find((item) => item.statistic === statistic && item.value != null);
    if (match) {
      return match;
    }
  }

  return normalized.find((item) => item.value != null) ?? { statistic: "VALUE", value: null };
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.text();
}

async function loadRuntimeMetric(
  service: RuntimeServiceConfig,
  metric: { name: string; label: string },
): Promise<RuntimeMetricSnapshot | null> {
  try {
    const payload = await fetchJson(
      `${service.basePath}/actuator/metrics/${encodeURIComponent(metric.name)}`,
    );
    const measurement = pickMeasurement(payload);
    const baseUnit = isRecord(payload) ? readString(payload.baseUnit) : "";

    return {
      name: metric.name,
      label: metric.label,
      statistic: measurement.statistic,
      value: measurement.value,
      baseUnit: baseUnit || undefined,
    };
  } catch {
    return null;
  }
}

async function loadRuntimeService(service: RuntimeServiceConfig): Promise<RuntimeServiceSnapshot> {
  const [healthResult, metricsResult, prometheusResult] = await Promise.allSettled([
    fetchJson(`${service.basePath}/actuator/health`),
    fetchJson(`${service.basePath}/actuator/metrics`),
    fetchText(`${service.basePath}/actuator/prometheus`),
  ]);

  const healthPayload = healthResult.status === "fulfilled" ? healthResult.value : null;
  const metricsPayload = metricsResult.status === "fulfilled" ? metricsResult.value : null;
  const prometheusText = prometheusResult.status === "fulfilled" ? prometheusResult.value : "";

  const healthStatus =
    isRecord(healthPayload) ? readString(healthPayload.status, "UNKNOWN").toUpperCase() : "UNAVAILABLE";

  const components =
    isRecord(healthPayload) && isRecord(healthPayload.components)
      ? Object.entries(healthPayload.components)
          .filter(([, value]) => isRecord(value))
          .map(([key, value]) =>
            isRecord(value)
              ? `${key}:${readString(value.status, "UNKNOWN").toUpperCase()}`
              : `${key}:UNKNOWN`,
          )
          .slice(0, 4)
      : [];

  const metricNames =
    isRecord(metricsPayload) ? readStringArray(metricsPayload.names) : [];

  const keyMetrics = (
    await Promise.all(
      service.metrics
        .filter((metric) => metricNames.includes(metric.name))
        .map((metric) => loadRuntimeMetric(service, metric)),
    )
  ).filter((metric): metric is RuntimeMetricSnapshot => metric != null);

  const prometheusSeries = prometheusText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));

  const prometheusPreview = prometheusSeries
    .filter((line) => /^(lsf_|jvm_|process_|system_|http_server_)/.test(line))
    .slice(0, 3);

  return {
    key: service.key,
    label: service.label,
    role: service.role,
    healthStatus,
    healthAvailable: healthResult.status === "fulfilled",
    components,
    metricsIndexAvailable: metricsResult.status === "fulfilled",
    metricsCount: metricNames.length,
    prometheusAvailable: prometheusResult.status === "fulfilled",
    prometheusSeriesCount: prometheusSeries.length,
    prometheusPreview: prometheusPreview.length > 0 ? prometheusPreview : prometheusSeries.slice(0, 3),
    keyMetrics,
    notes:
      metricsResult.status === "rejected" && prometheusResult.status === "rejected"
        ? "Các endpoint chỉ số chưa được cấu hình hoặc chưa truy cập được."
        : undefined,
  };
}

export const operationsVisibilityApi = {
  async getSkuOptions(limit = 16): Promise<VisibilitySkuOption[]> {
    const products = await productApi.getAll();

    const variants = products.flatMap((product) =>
      (product.variants || []).map((variant: ProductVariant) => ({
        skuCode: variant.skuCode,
        label: `${variant.skuCode}${product.name ? ` - ${product.name}` : ""}`,
        productName: product.name,
        color: variant.color,
        size: variant.size,
      })),
    );

    return variants.slice(0, limit);
  },

  async getOutboxRows(params: {
    limit?: number;
    msgKey?: string;
    topic?: string;
    eventType?: string;
  }): Promise<OutboxVisibilityRow[]> {
    const payload = await axiosClient.get<unknown, unknown>("/api/system/outbox", {
      params,
    });

    return unwrapCollection<unknown>(payload, ["items", "content", "data"])
      .map(normalizeOutboxRow)
      .filter((row) => row.id > 0 || row.eventId);
  },

  async getKafkaAdminIndex(): Promise<KafkaAdminIndex> {
    const payload = await axiosClient.get<unknown, unknown>("/api/system/kafka");
    return normalizeKafkaAdminIndex(payload);
  },

  async getSagaSnapshot(): Promise<SagaAdminSnapshot> {
    const payload = await axiosClient.get<unknown, unknown>("/api/system/saga");
    return normalizeSagaSnapshot(payload);
  },

  async getKafkaTopics(): Promise<string[]> {
    const payload = await axiosClient.get<unknown, unknown>("/api/system/kafka/dlq/topics");
    return Array.isArray(payload)
      ? payload.filter((item): item is string => typeof item === "string")
      : [];
  },

  async getKafkaRecords(params: {
    topic: string;
    partition?: number;
    limit?: number;
    beforeOffset?: number;
  }): Promise<KafkaDlqRecord[]> {
    const payload = await axiosClient.get<unknown, unknown>("/api/system/kafka/dlq/records", {
      params,
    });

    return unwrapCollection<unknown>(payload, ["items", "content", "data"])
      .map(normalizeKafkaDlqRecord)
      .filter((row) => row.topic);
  },

  async getRuntimeSnapshots(): Promise<RuntimeServiceSnapshot[]> {
    return Promise.all(runtimeServiceConfigs.map((service) => loadRuntimeService(service)));
  },
};
