"use client";

import { Alert, Card, Empty, Spin, Tag } from "antd";
import { useEffect, useState } from "react";
import type {
  InventoryAvailabilityResponse,
  OrderReservationItemResponse,
  OrderReservationSummaryResponse,
} from "@/services/inventoryApi";
import { formatDurationMs, formatMillis } from "./frameworkEvidenceUtils";

interface ReservationEvidencePanelProps {
  trackedOrderNumber?: string;
  trackedSku: string;
  availability?: InventoryAvailabilityResponse;
  loading?: boolean;
  error?: boolean;
  reservation?: OrderReservationSummaryResponse | null;
  reservationLoading?: boolean;
  reservationError?: boolean;
  quickSkuOptions: string[];
  onTrackedSkuChange: (value?: string) => void;
}

function segmentWidth(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, (value / total) * 100));
}

function getReservationTag(state?: string) {
  switch ((state || "").toUpperCase()) {
    case "RESERVED":
      return <Tag color="gold">Đang giữ chỗ</Tag>;
    case "CONFIRMED":
      return <Tag color="green">Đã xác nhận</Tag>;
    case "RELEASED":
      return <Tag color="blue">Đã trả lại</Tag>;
    case "EXPIRED":
      return <Tag color="red">Đã hết hạn</Tag>;
    case "NOT_FOUND":
      return <Tag>Chưa có dữ liệu</Tag>;
    default:
      return <Tag>Đang cập nhật</Tag>;
  }
}

function formatClock(value: number) {
  if (!value || value <= 0) return "00:00";

  const totalSeconds = Math.ceil(value / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
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
        <div>Giữ chỗ lúc: {formatMillis(item.reservedAtMs)}</div>
        <div>Hết hạn lúc: {formatMillis(item.expiresAtMs)}</div>
        {item.confirmedAtMs ? <div>Xác nhận lúc: {formatMillis(item.confirmedAtMs)}</div> : null}
        {item.releasedAtMs ? <div>Trả lại lúc: {formatMillis(item.releasedAtMs)}</div> : null}
        {item.reason ? <div>Lý do: {item.reason}</div> : null}
      </div>
    </div>
  );
}

const allocationLegend = [
  {
    label: "Đã giữ chỗ",
    accentClass: "bg-amber-400",
    textClass: "text-amber-700",
  },
  {
    label: "Đã xác nhận",
    accentClass: "bg-sky-500",
    textClass: "text-sky-700",
  },
  {
    label: "Có thể bán",
    accentClass: "bg-emerald-500",
    textClass: "text-emerald-700",
  },
];

export default function ReservationEvidencePanel({
  trackedOrderNumber,
  trackedSku,
  availability,
  loading,
  error,
  reservation,
  reservationLoading,
  reservationError,
  quickSkuOptions,
  onTrackedSkuChange,
}: ReservationEvidencePanelProps) {
  const [nowMs, setNowMs] = useState(Date.now());
  const physical = availability?.physicalStock || 0;
  const quotaUsed = availability?.quotaUsed || 0;
  const reserved = availability?.reservedCount || 0;
  const confirmed = availability?.confirmedCount || 0;
  const available = availability?.availableStock || 0;
  const denominator = Math.max(physical, reserved + confirmed + available, 1);
  const lowStock = availability ? available <= Math.max(2, Math.floor(physical * 0.2)) : false;
  const countdownMs =
    reservation?.countdownActive && reservation.expiresAtMs
      ? Math.max(reservation.expiresAtMs - nowMs, 0)
      : 0;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <Card
      className="app-admin-card border-0"
      title="Giữ chỗ và tồn khả dụng"
      extra={
        trackedSku ? (
          <Tag color={availability && lowStock ? "gold" : "blue"}>{trackedSku}</Tag>
        ) : (
          <Tag>SKU</Tag>
        )
      }
    >
      <div className="space-y-4">
        <div className="rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-[var(--color-primary)]">Giữ chỗ theo đơn</div>
              <div className="mt-1 text-sm text-[var(--color-secondary)]">
                {trackedOrderNumber ? `Đơn đang theo dõi: ${trackedOrderNumber}` : "Chưa chọn đơn để theo dõi"}
              </div>
            </div>
            {reservationLoading && !reservation ? <Tag color="processing">Đang tải dữ liệu</Tag> : null}
          </div>

          {reservationError ? (
            <Alert
              className="mt-4"
              type="warning"
              showIcon
              message="Không đọc được dữ liệu giữ chỗ của đơn này"
            />
          ) : reservation ? (
            <div className="mt-4 space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-[20px] border border-[var(--color-border)] bg-white px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Trạng thái</div>
                  <div className="mt-2">{getReservationTag(reservation.state)}</div>
                </div>

                <div className="rounded-[20px] border border-[var(--color-border)] bg-white px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Hết hạn lúc</div>
                  <div className="mt-2 text-base font-semibold text-[var(--color-primary)]">
                    {formatMillis(reservation.expiresAtMs)}
                  </div>
                </div>

                <div className="rounded-[20px] border border-[var(--color-border)] bg-white px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Thời gian còn lại</div>
                  <div className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-primary)]">
                    {reservation.countdownActive ? formatClock(countdownMs) : "00:00"}
                  </div>
                  <div className="mt-1 text-sm text-[var(--color-secondary)]">
                    Hệ thống đang báo còn {formatDurationMs(reservation.remainingMs)}.
                  </div>
                </div>

                <div className="rounded-[20px] border border-[var(--color-border)] bg-white px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Số SKU giữ chỗ</div>
                  <div className="mt-2 text-3xl font-semibold text-[var(--color-primary)]">
                    {reservation.items.length}
                  </div>
                  <div className="mt-1 text-sm text-[var(--color-secondary)]">
                    {reservation.items.length > 0
                      ? "Các dòng giữ chỗ đang gắn với đơn này."
                      : "Chưa có dòng giữ chỗ chi tiết."}
                  </div>
                </div>
              </div>

              {reservation.items.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">{reservation.items.map(renderReservationItem)}</div>
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="Đơn này hiện chưa có dòng giữ chỗ chi tiết."
                />
              )}
            </div>
          ) : (
            <Empty
              className="mt-4"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Chọn đơn để xem dữ liệu giữ chỗ."
            />
          )}
        </div>

        {quickSkuOptions.length > 0 ? (
          <div className="rounded-[22px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-4">
            <div className="text-sm font-semibold text-[var(--color-primary)]">SKU trong đơn đang theo dõi</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {quickSkuOptions.map((skuCode) => (
                <button
                  key={skuCode}
                  type="button"
                  onClick={() => onTrackedSkuChange(skuCode)}
                  className={`rounded-full border px-3 py-2 text-xs font-medium transition ${
                    trackedSku === skuCode
                      ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                      : "border-[var(--color-border)] bg-white text-[var(--color-primary)] hover:border-[var(--color-primary)]"
                  }`}
                >
                  {skuCode}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="flex min-h-[240px] items-center justify-center">
            <Spin />
          </div>
        ) : error ? (
          <Alert type="warning" showIcon message="Chưa đọc được availability theo SKU" />
        ) : availability ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
                  Tồn vật lý
                </div>
                <div className="mt-2 text-3xl font-semibold text-[var(--color-primary)]">{physical}</div>
              </div>
              <div className="rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
                  Đã dùng trong quota
                </div>
                <div className="mt-2 text-3xl font-semibold text-[var(--color-primary)]">{quotaUsed}</div>
              </div>
              <div className="rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
                  Đã giữ chỗ
                </div>
                <div className="mt-2 text-3xl font-semibold text-amber-600">{reserved}</div>
              </div>
              <div className="rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
                  Đã xác nhận
                </div>
                <div className="mt-2 text-3xl font-semibold text-sky-700">{confirmed}</div>
              </div>
              <div className="rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
                  Có thể bán ngay
                </div>
                <div className="mt-2 text-3xl font-semibold text-emerald-700">{available}</div>
              </div>
            </div>

            <div className="rounded-[24px] border border-[var(--color-border)] bg-white px-5 py-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="text-sm font-semibold text-[var(--color-primary)]">Cách tồn kho đang được phân bổ</div>
                <Tag color={available >= 0 ? "green" : "red"}>
                  {available >= 0 ? "Tồn khả dụng hợp lệ" : "Tồn khả dụng đang âm"}
                </Tag>
              </div>

              <div className="mt-5 overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
                <div className="flex h-4 w-full overflow-hidden rounded-full">
                  <div
                    className="bg-amber-400"
                    style={{ width: `${segmentWidth(reserved, denominator)}%` }}
                  />
                  <div
                    className="bg-sky-500"
                    style={{ width: `${segmentWidth(confirmed, denominator)}%` }}
                  />
                  <div
                    className="bg-emerald-500"
                    style={{ width: `${segmentWidth(available, denominator)}%` }}
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                {allocationLegend.map((item) => (
                  <div
                    key={item.label}
                    className="inline-flex items-center gap-3 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-2"
                  >
                    <span className={`h-3 w-3 rounded-full ${item.accentClass}`} />
                    <span className={`text-sm font-medium ${item.textClass}`}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nhập hoặc chọn một SKU để xem." />
        )}
      </div>
    </Card>
  );
}
