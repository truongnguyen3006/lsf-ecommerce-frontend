"use client";

import { Alert, Card, Empty, Spin, Tag, Timeline, Typography } from "antd";
import type { OrderResponse } from "@/services/orderApi";
import type { SagaInstanceView, SagaPendingSessionView } from "@/services/operationsVisibilityApi";
import {
  formatDateTime,
  formatDurationMs,
  formatMillis,
  formatMoney,
  orderTag,
  sagaTag,
} from "./frameworkEvidenceUtils";

const { Paragraph } = Typography;

interface WorkflowTimelinePanelProps {
  trackedOrderNumber: string;
  order?: OrderResponse;
  orderLoading?: boolean;
  orderError?: boolean;
  relatedSaga?: SagaInstanceView;
  pendingSession?: SagaPendingSessionView;
  hasSagaSnapshot?: boolean;
  onTrackedSkuChange: (value?: string) => void;
}

type TimelineVisual = {
  color: string;
};

function includesPaymentHint(value?: string) {
  return (value || "").toUpperCase().includes("PAYMENT");
}

function resolveVisual(kind: "done" | "active" | "failed" | "idle"): TimelineVisual {
  if (kind === "done") return { color: "green" };
  if (kind === "active") return { color: "gold" };
  if (kind === "failed") return { color: "red" };
  return { color: "gray" };
}

export default function WorkflowTimelinePanel({
  trackedOrderNumber,
  order,
  orderLoading,
  orderError,
  relatedSaga,
  pendingSession,
  hasSagaSnapshot,
  onTrackedSkuChange,
}: WorkflowTimelinePanelProps) {
  const hasTrackedOrder = Boolean(trackedOrderNumber);
  const paymentFailure =
    order?.status === "PAYMENT_FAILED" || includesPaymentHint(relatedSaga?.failureReason);
  const inventoryFailure = order?.status === "FAILED" && !paymentFailure;
  const sagaWaiting =
    relatedSaga?.status === "WAITING" ||
    relatedSaga?.status === "RUNNING" ||
    relatedSaga?.status === "COMPENSATING";

  const timelineItems = [
    {
      title: "Đơn được tiếp nhận",
      kind: order ? "done" : hasTrackedOrder ? "active" : "idle",
      description: order ? (
        <div className="space-y-1">
          <div>
            {orderTag(order.status)}{" "}
            <span className="ml-2 text-[var(--color-secondary)]">{formatDateTime(order.orderDate)}</span>
          </div>
          <div className="text-sm text-[var(--color-secondary)]">
            {order.orderLineItemsList.length} sản phẩm, tổng tiền {formatMoney(order.totalPrice)}.
          </div>
        </div>
      ) : hasTrackedOrder ? (
        "Đã bật theo dõi, đang chờ chi tiết đơn."
      ) : (
        "Chọn một đơn để bắt đầu theo dõi."
      ),
    },
    {
      title: "Tồn kho / reservation",
      kind: pendingSession
        ? "active"
        : inventoryFailure
          ? "failed"
          : order && ["VALIDATED", "COMPLETED", "PAYMENT_FAILED"].includes(order.status)
            ? "done"
            : sagaWaiting
              ? "active"
              : "idle",
      description: pendingSession ? (
        <div className="space-y-1">
          <div className="text-sm text-[var(--color-secondary)]">
            Bridge đang chờ {pendingSession.receivedItems}/{pendingSession.totalItems} phản hồi.
          </div>
          <div className="text-sm text-[var(--color-secondary)]">
            Tuổi phiên {formatDurationMs(pendingSession.ageMs)}. Hết hạn lúc {formatMillis(pendingSession.expiresAtMs)}.
          </div>
        </div>
      ) : inventoryFailure ? (
        "Luồng dừng trước bước thanh toán."
      ) : order && ["VALIDATED", "COMPLETED", "PAYMENT_FAILED"].includes(order.status) ? (
        "Đơn đã đi qua bước validation."
      ) : (
        "Chưa có đủ tín hiệu để kết luận."
      ),
    },
    {
      title: "Thanh toán",
      kind: order?.status === "COMPLETED"
        ? "done"
        : paymentFailure
          ? "failed"
          : sagaWaiting || order?.status === "VALIDATED"
            ? "active"
            : "idle",
      description:
        order?.status === "COMPLETED"
          ? "Thanh toán hoàn tất."
          : paymentFailure
            ? relatedSaga?.failureReason || "Thanh toán thất bại."
            : sagaWaiting || order?.status === "VALIDATED"
              ? "Thanh toán đang chạy hoặc đang chờ."
              : "Chưa có tín hiệu rõ.",
    },
    {
      title: "Điều phối Saga",
      kind: relatedSaga
        ? ["FAILED", "TIMED_OUT", "COMPENSATION_FAILED"].includes(relatedSaga.status)
          ? "failed"
          : ["WAITING", "RUNNING", "COMPENSATING"].includes(relatedSaga.status)
            ? "active"
            : "done"
        : hasTrackedOrder
          ? "active"
          : "idle",
      description: relatedSaga ? (
        <div className="space-y-1">
          <div>
            {sagaTag(relatedSaga.status)}{" "}
            <span className="ml-2 text-[var(--color-secondary)]">
              pha {relatedSaga.phase || "UNKNOWN"} / bước {relatedSaga.currentStep || "không có"}
            </span>
          </div>
          <div className="text-sm text-[var(--color-secondary)]">
            {relatedSaga.sagaId} | cập nhật {formatMillis(relatedSaga.updatedAtMs)}
          </div>
        </div>
      ) : hasTrackedOrder ? (
        hasSagaSnapshot
          ? "Có Saga trong snapshot hiện tại nhưng chưa khớp trực tiếp với đơn đang theo dõi."
          : "Chưa thấy Saga trong snapshot hiện tại."
      ) : (
        "Chọn đơn để theo dõi."
      ),
    },
  ];

  return (
    <Card className="app-admin-card border-0" title="Theo dấu theo đơn hàng">
      <div className="space-y-4">
        {orderLoading ? (
          <div className="flex min-h-[260px] items-center justify-center">
            <Spin />
          </div>
        ) : orderError && hasTrackedOrder && !order ? (
          <Alert type="warning" showIcon message={`Không tải được đơn ${trackedOrderNumber}`} />
        ) : !hasTrackedOrder && !order ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chọn một đơn để theo dõi." />
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[22px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
                  Đơn đang theo dõi
                </div>
                <div className="mt-2 text-lg font-semibold text-[var(--color-primary)]">
                  {order?.orderNumber || trackedOrderNumber}
                </div>
                <div className="mt-1 text-sm text-[var(--color-secondary)]">
                  {order ? `${order.orderLineItemsList.length} dòng sản phẩm` : "Đang chờ tải chi tiết"}
                </div>
              </div>
              <div className="rounded-[22px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
                  Trạng thái đơn
                </div>
                <div className="mt-2">{order ? orderTag(order.status) : <Tag>Đang chờ</Tag>}</div>
                <div className="mt-2 text-sm text-[var(--color-secondary)]">
                  {order ? formatDateTime(order.orderDate) : "Chưa có snapshot"}
                </div>
              </div>
              <div className="rounded-[22px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
                  Saga khớp
                </div>
                <div className="mt-2">{relatedSaga ? sagaTag(relatedSaga.status) : <Tag>Chưa khớp</Tag>}</div>
                <div className="mt-2 text-sm text-[var(--color-secondary)]">
                  {relatedSaga ? relatedSaga.sagaId : "Đang dò theo snapshot hiện có"}
                </div>
              </div>
              <div className="rounded-[22px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
                  Bridge đang chờ
                </div>
                <div className="mt-2 text-lg font-semibold text-[var(--color-primary)]">
                  {pendingSession ? `${pendingSession.receivedItems}/${pendingSession.totalItems}` : "Không có"}
                </div>
                <div className="mt-1 text-sm text-[var(--color-secondary)]">
                  {pendingSession ? formatDurationMs(pendingSession.ageMs) : "Snapshot hiện tại"}
                </div>
              </div>
            </div>

            {order?.orderLineItemsList.length ? (
              <div className="rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-4">
                <div className="text-sm font-semibold text-[var(--color-primary)]">SKU trong đơn này</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {order.orderLineItemsList.map((item) => (
                    <button
                      key={`${item.id}-${item.skuCode}`}
                      type="button"
                      onClick={() => onTrackedSkuChange(item.skuCode)}
                      className="rounded-full border border-[var(--color-border)] bg-white px-3 py-2 text-xs font-medium text-[var(--color-primary)] transition hover:border-[var(--color-primary)]"
                    >
                      {item.skuCode} - qty {item.quantity}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <Timeline
              className="!mt-2"
              items={timelineItems.map((item) => {
                const visual = resolveVisual(item.kind as "done" | "active" | "failed" | "idle");
                return {
                  color: visual.color,
                  children: (
                    <div className="pb-3">
                      <div className="text-base font-semibold text-[var(--color-primary)]">{item.title}</div>
                      <Paragraph className="!mb-0 !mt-1 text-sm leading-7 !text-[var(--color-secondary)]">
                        {item.description}
                      </Paragraph>
                    </div>
                  ),
                };
              })}
            />
          </>
        )}
      </div>
    </Card>
  );
}
