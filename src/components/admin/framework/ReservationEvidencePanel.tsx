"use client";

import { Alert, Card, Empty, Spin, Tag } from "antd";
import type { InventoryAvailabilityResponse } from "@/services/inventoryApi";

interface ReservationEvidencePanelProps {
  trackedSku: string;
  availability?: InventoryAvailabilityResponse;
  loading?: boolean;
  error?: boolean;
  quickSkuOptions: string[];
  onTrackedSkuChange: (value?: string) => void;
}

function segmentWidth(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, (value / total) * 100));
}

export default function ReservationEvidencePanel({
  trackedSku,
  availability,
  loading,
  error,
  quickSkuOptions,
  onTrackedSkuChange,
}: ReservationEvidencePanelProps) {
  const physical = availability?.physicalStock || 0;
  const quotaUsed = availability?.quotaUsed || 0;
  const reserved = availability?.reservedCount || 0;
  const confirmed = availability?.confirmedCount || 0;
  const available = availability?.availableStock || 0;
  const denominator = Math.max(physical, reserved + confirmed + available, 1);
  const lowStock = availability ? available <= Math.max(2, Math.floor(physical * 0.2)) : false;

  return (
    <Card
      className="app-admin-card border-0"
      title="Reservation / chống oversell"
      extra={
        trackedSku ? (
          <Tag color={availability && lowStock ? "gold" : "blue"}>{trackedSku}</Tag>
        ) : (
          <Tag>SKU</Tag>
        )
      }
    >
      <div className="space-y-4">
        {quickSkuOptions.length > 0 ? (
          <div className="rounded-[22px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-4">
            <div className="text-sm font-semibold text-[var(--color-primary)]">
              SKU từ đơn đang theo dõi
            </div>
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
          <Alert type="warning" showIcon message="Chưa đọc được availability" />
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
                  Quota đã dùng
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
                  Có thể bán
                </div>
                <div className="mt-2 text-3xl font-semibold text-emerald-700">{available}</div>
              </div>
            </div>

            <div className="rounded-[24px] border border-[var(--color-border)] bg-white px-5 py-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="text-sm font-semibold text-[var(--color-primary)]">Phân bổ tồn</div>
                <Tag color={available >= 0 ? "green" : "red"}>
                  {available >= 0 ? "available không âm" : "available đang âm"}
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

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-[18px] bg-amber-50 px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-amber-700">Đã giữ chỗ</div>
                  <div className="mt-1 text-xl font-semibold text-amber-900">{reserved}</div>
                </div>
                <div className="rounded-[18px] bg-sky-50 px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-sky-700">Đã xác nhận</div>
                  <div className="mt-1 text-xl font-semibold text-sky-900">{confirmed}</div>
                </div>
                <div className="rounded-[18px] bg-emerald-50 px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-emerald-700">Có thể bán</div>
                  <div className="mt-1 text-xl font-semibold text-emerald-900">{available}</div>
                </div>
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
