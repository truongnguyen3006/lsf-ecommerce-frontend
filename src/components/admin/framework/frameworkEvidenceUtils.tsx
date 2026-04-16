import { Tag } from "antd";
import type {
  KafkaDlqRecord,
  OutboxVisibilityRow,
  RuntimeMetricSnapshot,
  SagaAdminSnapshot,
  SagaInstanceView,
  SagaPendingSessionView,
} from "@/services/operationsVisibilityApi";

function parseDateValue(value?: string | number | Date) {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTime(value?: string) {
  if (!value) return "—";
  const date = parseDateValue(value);
  if (!date) return value;

  return new Intl.DateTimeFormat("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatMillis(value?: number) {
  if (!value) return "—";
  return formatDateTime(new Date(value).toISOString());
}

export function formatRelativeTime(value?: string | number | Date) {
  const date = parseDateValue(value);
  if (!date) return "";

  const diffMs = date.getTime() - Date.now();
  const past = diffMs <= 0;
  const absMs = Math.abs(diffMs);

  if (absMs < 5_000) return "vừa xong";
  if (absMs < 60_000) {
    const seconds = Math.max(1, Math.round(absMs / 1_000));
    return past ? `${seconds}s trước` : `${seconds}s nữa`;
  }
  if (absMs < 3_600_000) {
    const minutes = Math.max(1, Math.round(absMs / 60_000));
    return past ? `${minutes} phút trước` : `${minutes} phút nữa`;
  }
  if (absMs < 86_400_000) {
    const hours = Math.max(1, Math.round(absMs / 3_600_000));
    return past ? `${hours} giờ trước` : `${hours} giờ nữa`;
  }

  const days = Math.max(1, Math.round(absMs / 86_400_000));
  return past ? `${days} ngày trước` : `${days} ngày nữa`;
}

export function formatDateTimeWithRelative(value?: string) {
  const formatted = formatDateTime(value);
  const relative = formatRelativeTime(value);

  if (!relative || formatted === "—") {
    return formatted;
  }

  return `${formatted} (${relative})`;
}

export function formatOutboxPrimaryTimeWithRelative(row: OutboxVisibilityRow) {
  const createdAt = parseDateValue(row.createdAt);
  const sentAt = parseDateValue(row.sentAt);
  const timezoneOffsetMs = Math.abs(new Date().getTimezoneOffset()) * 60_000;

  if (row.status === "SENT" && createdAt && sentAt && timezoneOffsetMs > 0) {
    const driftMs = Math.abs(sentAt.getTime() - createdAt.getTime());

    // Some environments surface createdAt with a timezone drift while sentAt
    // stays aligned with the operator-facing local clock. Prefer sentAt as the
    // primary display when the gap matches the local timezone offset.
    if (Math.abs(driftMs - timezoneOffsetMs) <= 5 * 60_000) {
      return formatDateTimeWithRelative(row.sentAt);
    }
  }

  return formatDateTimeWithRelative(row.createdAt || row.sentAt);
}

export function formatDurationMs(value?: number) {
  if (!value || value <= 0) return "0s";
  if (value < 1000) return `${Math.round(value)} ms`;

  const totalSeconds = Math.round(value / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function formatMetric(metric: RuntimeMetricSnapshot) {
  if (metric.value == null) return "—";
  if (metric.name.includes("cpu.usage") && metric.value <= 1) {
    return `${(metric.value * 100).toFixed(1)}%`;
  }
  if (metric.baseUnit === "seconds" || metric.name.includes("uptime")) {
    return `${metric.value.toFixed(0)} s`;
  }
  return Number.isInteger(metric.value) ? `${metric.value}` : metric.value.toFixed(2);
}

export function normalizeToken(value?: string) {
  return value?.trim().toUpperCase() ?? "";
}

function tokenIncludes(candidate: string | number | undefined, focusToken: string) {
  if (!focusToken) return false;
  return normalizeToken(String(candidate ?? "")).includes(focusToken);
}

export function healthTag(status: string) {
  if (status === "UP") return <Tag color="green">UP</Tag>;
  if (status === "DOWN") return <Tag color="red">DOWN</Tag>;
  if (status === "UNAVAILABLE") return <Tag>UNAVAILABLE</Tag>;
  return <Tag color="blue">{status || "UNKNOWN"}</Tag>;
}

export function orderTag(status: string) {
  if (status === "COMPLETED") return <Tag color="green">COMPLETED</Tag>;
  if (status === "FAILED" || status === "PAYMENT_FAILED") return <Tag color="red">{status}</Tag>;
  if (status === "VALIDATED") return <Tag color="blue">VALIDATED</Tag>;
  if (status === "PENDING") return <Tag color="gold">PENDING</Tag>;
  return <Tag>{status || "UNKNOWN"}</Tag>;
}

export function outboxTag(status: string) {
  if (status === "SENT") return <Tag color="green">SENT</Tag>;
  if (status === "FAILED") return <Tag color="red">FAILED</Tag>;
  if (status === "RETRY") return <Tag color="gold">RETRY</Tag>;
  if (status === "NEW") return <Tag color="blue">NEW</Tag>;
  return <Tag>{status || "UNKNOWN"}</Tag>;
}

export function sagaTag(status: string) {
  if (status === "COMPLETED") return <Tag color="green">COMPLETED</Tag>;
  if (status === "COMPENSATED") return <Tag color="blue">COMPENSATED</Tag>;
  if (status === "WAITING" || status === "RUNNING" || status === "COMPENSATING") {
    return <Tag color="gold">{status}</Tag>;
  }
  if (
    status === "FAILED" ||
    status === "TIMED_OUT" ||
    status === "COMPENSATION_FAILED"
  ) {
    return <Tag color="red">{status}</Tag>;
  }
  return <Tag>{status || "UNKNOWN"}</Tag>;
}

export function outboxMatchesOrder(row: OutboxVisibilityRow, orderToken: string) {
  return (
    tokenIncludes(row.msgKey, orderToken) ||
    tokenIncludes(row.eventId, orderToken) ||
    tokenIncludes(row.lastError, orderToken)
  );
}

export function sagaMatchesOrder(row: SagaInstanceView, orderToken: string) {
  return tokenIncludes(row.sagaId, orderToken) || tokenIncludes(row.correlationId, orderToken);
}

export function pendingSessionMatchesOrder(row: SagaPendingSessionView, orderToken: string) {
  return tokenIncludes(row.orderNumber, orderToken);
}

export function kafkaRecordMatchesOrder(row: KafkaDlqRecord, orderToken: string) {
  return (
    tokenIncludes(row.key, orderToken) ||
    tokenIncludes(row.correlationId, orderToken) ||
    tokenIncludes(row.requestId, orderToken) ||
    tokenIncludes(row.eventId, orderToken)
  );
}

export function getSagaCatalog(snapshot?: SagaAdminSnapshot) {
  if (!snapshot) return [];

  const rows = [
    ...snapshot.recentInstances,
    ...snapshot.recentFailures,
    ...snapshot.recentCompensations,
    ...snapshot.overdueInstances,
  ];

  const deduped = new Map<string, SagaInstanceView>();
  rows.forEach((row) => {
    if (row.sagaId && !deduped.has(row.sagaId)) {
      deduped.set(row.sagaId, row);
    }
  });

  return Array.from(deduped.values()).sort((left, right) => right.updatedAtMs - left.updatedAtMs);
}

export function pickFocusedSaga(snapshot: SagaAdminSnapshot | undefined, orderToken: string) {
  return getSagaCatalog(snapshot).find((row) => sagaMatchesOrder(row, orderToken));
}

export function describeOutboxHealth(rows: OutboxVisibilityRow[]) {
  return {
    sent: rows.filter((row) => row.status === "SENT").length,
    retrying: rows.filter((row) => row.status === "RETRY" || row.status === "NEW").length,
    failed: rows.filter((row) => row.status === "FAILED").length,
  };
}

export function scenarioToneClasses(
  tone: "emerald" | "rose" | "amber" | "sky" | "cyan",
  selected: boolean,
) {
  const map = {
    emerald: selected
      ? "border-emerald-300 bg-emerald-50 text-emerald-950 shadow-[0_16px_40px_rgba(16,185,129,0.15)]"
      : "border-white/15 bg-white/6 text-white/86 hover:border-emerald-300/50 hover:bg-white/10",
    rose: selected
      ? "border-rose-300 bg-rose-50 text-rose-950 shadow-[0_16px_40px_rgba(244,63,94,0.15)]"
      : "border-white/15 bg-white/6 text-white/86 hover:border-rose-300/50 hover:bg-white/10",
    amber: selected
      ? "border-amber-300 bg-amber-50 text-amber-950 shadow-[0_16px_40px_rgba(245,158,11,0.16)]"
      : "border-white/15 bg-white/6 text-white/86 hover:border-amber-300/50 hover:bg-white/10",
    sky: selected
      ? "border-sky-300 bg-sky-50 text-sky-950 shadow-[0_16px_40px_rgba(14,165,233,0.15)]"
      : "border-white/15 bg-white/6 text-white/86 hover:border-sky-300/50 hover:bg-white/10",
    cyan: selected
      ? "border-cyan-300 bg-cyan-50 text-cyan-950 shadow-[0_16px_40px_rgba(6,182,212,0.15)]"
      : "border-white/15 bg-white/6 text-white/86 hover:border-cyan-300/50 hover:bg-white/10",
  };

  return map[tone];
}
