"use client";

import { Alert, Card, Empty, Spin, Tag, Timeline, Typography } from "antd";
import { getPaymentMethodMeta } from "@/lib/payment-method";
import { getOrderTrackingSteps, type TrackingStepItem } from "@/lib/order-status";
import type { OrderReservationSummaryResponse } from "@/services/inventoryApi";
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
  reservation?: OrderReservationSummaryResponse | null;
  reservationLoading?: boolean;
  reservationError?: boolean;
  relatedSaga?: SagaInstanceView;
  pendingSession?: SagaPendingSessionView;
  hasSagaSnapshot?: boolean;
  displaySkuItems?: Array<{
    id: string;
    skuCode: string;
    quantity: number;
  }>;
  onTrackedSkuChange: (value?: string) => void;
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

function formatCountdown(value?: number) {
  if (!value || value <= 0) return "00:00";

  const totalSeconds = Math.ceil(value / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function resolveTimelineColor(status: TrackingStepItem["status"]) {
  if (status === "finish") return "green";
  if (status === "process") return "gold";
  if (status === "error") return "red";
  return "gray";
}

function resolveSagaStepLabel(step?: string) {
  if (!step) return "";
  if (step === "inventoryValidation") return "giữ chỗ tồn kho";
  if (step === "paymentProcessing") return "xử lý thanh toán";
  return step;
}

function buildStepDescription(
  index: number,
  fallbackDescription: string | undefined,
  order?: OrderResponse,
  reservation?: OrderReservationSummaryResponse | null,
  relatedSaga?: SagaInstanceView,
  pendingSession?: SagaPendingSessionView,
) {
  const reservationState = (reservation?.state || "").toUpperCase();
  const paymentMethodMeta = getPaymentMethodMeta(order?.paymentMethod);

  if (index === 0) {
    if (!order) {
      return "Chọn một đơn hàng để bắt đầu theo dõi.";
    }

    return (
      <div className="space-y-1">
        <div>
          {orderTag(order.status)}{" "}
          <span className="ml-2 text-[var(--color-secondary)]">{formatDateTime(order.orderDate)}</span>
        </div>
        <div className="text-sm text-[var(--color-secondary)]">
          {order.orderLineItemsList.length} dòng sản phẩm, tổng tiền {formatMoney(order.totalPrice)}.
        </div>
      </div>
    );
  }

  if (index === 1) {
    if (reservation) {
      if (reservationState === "RESERVED") {
        return (
          <div className="space-y-1">
            <div className="text-sm text-[var(--color-secondary)]">
              Đơn đã được giữ chỗ cho {reservation.items.length} SKU.
            </div>
            <div className="text-sm text-[var(--color-secondary)]">
              Hết hạn lúc {formatMillis(reservation.expiresAtMs)}. Còn khoảng {formatCountdown(reservation.remainingMs)}.
            </div>
          </div>
        );
      }

      if (reservationState === "CONFIRMED") {
        return "Giữ chỗ đã được xác nhận sau khi thanh toán thành công.";
      }

      if (reservationState === "RELEASED") {
        return "Giữ chỗ đã được trả lại.";
      }

      if (reservationState === "EXPIRED") {
        return "Giữ chỗ đã hết hạn và không còn giữ cho đơn này.";
      }

      if (reservationState === "NOT_FOUND") {
        return "Chưa thấy dữ liệu giữ chỗ của đơn này.";
      }
    }

    if (pendingSession) {
      return (
        <div className="space-y-1">
          <div className="text-sm text-[var(--color-secondary)]">
            Đang chờ {pendingSession.receivedItems}/{pendingSession.totalItems} phản hồi giữ chỗ.
          </div>
          <div className="text-sm text-[var(--color-secondary)]">
            Tuổi phiên {formatDurationMs(pendingSession.ageMs)}. Hết hạn lúc {formatMillis(pendingSession.expiresAtMs)}.
          </div>
        </div>
      );
    }

    return fallbackDescription || "Đang chờ dữ liệu giữ chỗ.";
  }

  if (index === 2) {
    if (!order) {
      return fallbackDescription || "Đang chờ dữ liệu thanh toán.";
    }

    if (order.status === "VALIDATED") {
      return (
        <div className="space-y-1">
          <div className="text-sm text-[var(--color-secondary)]">
            Đơn đang chờ kết quả thanh toán với kịch bản{" "}
            <span className="font-medium text-[var(--color-primary)]">{paymentMethodMeta.label}</span>.
          </div>
        </div>
      );
    }

    if (order.status === "COMPLETED") {
      return reservationState === "CONFIRMED"
        ? "Thanh toán đã thành công và giữ chỗ đã được xác nhận."
        : "Thanh toán đã thành công, hệ thống đang xác nhận giữ chỗ.";
    }

    if (order.status === "PAYMENT_FAILED") {
      return reservationState === "RELEASED" || reservationState === "EXPIRED"
        ? "Thanh toán thất bại hoặc quá hạn, giữ chỗ đã đi vào nhánh trả lại."
        : "Thanh toán thất bại, hệ thống đang trả lại giữ chỗ.";
    }

    if (relatedSaga?.currentStep) {
      return `Luồng điều phối đang ở bước ${resolveSagaStepLabel(relatedSaga.currentStep)}.`;
    }

    return fallbackDescription || "Đang chờ dữ liệu thanh toán.";
  }

  if (reservationState === "CONFIRMED") {
    return "Kết thúc nhánh thành công: giữ chỗ đã được xác nhận và trạng thái đã khớp.";
  }

  if (reservationState === "RELEASED") {
    return "Kết thúc nhánh thất bại: giữ chỗ đã được trả lại.";
  }

  if (reservationState === "EXPIRED") {
    return "Kết thúc nhánh quá hạn: giữ chỗ đã hết hạn và được trả lại.";
  }

  if (relatedSaga) {
    return (
      <div className="space-y-1">
        <div>
          {sagaTag(relatedSaga.status)}{" "}
          {relatedSaga.currentStep ? (
            <span className="ml-2 text-[var(--color-secondary)]">
              bước {resolveSagaStepLabel(relatedSaga.currentStep)}
            </span>
          ) : null}
        </div>
        <div className="text-sm text-[var(--color-secondary)]">
          Luồng cập nhật lúc {formatMillis(relatedSaga.updatedAtMs)}.
        </div>
      </div>
    );
  }

  return fallbackDescription || "Hệ thống đang chốt trạng thái cuối.";
}

export default function WorkflowTimelinePanel({
  trackedOrderNumber,
  order,
  orderLoading,
  orderError,
  reservation,
  reservationLoading,
  reservationError,
  relatedSaga,
  pendingSession,
  hasSagaSnapshot,
  displaySkuItems = [],
  onTrackedSkuChange,
}: WorkflowTimelinePanelProps) {
  const hasTrackedOrder = Boolean(trackedOrderNumber);
  const paymentMethodMeta = getPaymentMethodMeta(order?.paymentMethod);
  const visibleSkuItems = displaySkuItems.length
    ? displaySkuItems
    : (order?.orderLineItemsList || []).map((item) => ({
        id: String(item.id ?? item.skuCode),
        skuCode: item.skuCode,
        quantity: item.quantity,
      }));
  const trackingSteps: TrackingStepItem[] = order
    ? getOrderTrackingSteps({
        status: order.status,
        reservationState: reservation?.state,
        hasReservation: Boolean(reservation?.items?.length),
      })
    : [
        { title: "Tiếp nhận đơn", status: "process", description: "Đang chờ chọn đơn để theo dõi." },
        { title: "Giữ chỗ tồn kho", status: "wait" },
        { title: "Chờ / xử lý thanh toán", status: "wait" },
        { title: "Hoàn tất hoặc hoàn lại", status: "wait" },
      ];

  return (
    <Card className="app-admin-card border-0" title="Theo dõi giữ chỗ → thanh toán → xác nhận hoặc trả lại">
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
                  {order ? `${visibleSkuItems.length} dòng sản phẩm` : "Đang chờ tải chi tiết"}
                </div>
              </div>

              <div className="rounded-[22px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
                  Kịch bản thanh toán
                </div>
                <div className="mt-2 text-base font-semibold text-[var(--color-primary)]">
                  {paymentMethodMeta.label}
                </div>
                <div className="mt-1 text-sm text-[var(--color-secondary)]">{paymentMethodMeta.helper}</div>
              </div>

              <div className="rounded-[22px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
                  Giữ chỗ theo đơn
                </div>
                <div className="mt-2">
                  {reservationLoading && !reservation ? <Tag color="processing">Đang tải</Tag> : getReservationTag(reservation?.state)}
                </div>
                <div className="mt-2 text-sm text-[var(--color-secondary)]">
                  {reservation?.countdownActive
                    ? `Còn khoảng ${formatCountdown(reservation.remainingMs)}`
                    : reservation?.expiresAtMs
                      ? `Hết hạn lúc ${formatMillis(reservation.expiresAtMs)}`
                      : "Chưa có mốc thời gian"}
                </div>
              </div>

              <div className="rounded-[22px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
                  Luồng điều phối
                </div>
                <div className="mt-2">{relatedSaga ? sagaTag(relatedSaga.status) : <Tag>Chưa thấy saga</Tag>}</div>
                <div className="mt-2 text-sm text-[var(--color-secondary)]">
                  {relatedSaga?.currentStep
                    ? `Bước hiện tại: ${resolveSagaStepLabel(relatedSaga.currentStep)}`
                    : hasSagaSnapshot
                      ? "Chưa thấy luồng khớp trực tiếp với đơn này"
                      : "Chưa có dữ liệu luồng"}
                </div>
              </div>
            </div>

            {reservationError ? (
              <Alert
                type="warning"
                showIcon
                message="Không đọc được dữ liệu giữ chỗ của đơn này"
              />
            ) : null}

            {visibleSkuItems.length ? (
              <div className="rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-4">
                <div className="text-sm font-semibold text-[var(--color-primary)]">SKU trong đơn này</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {visibleSkuItems.map((item) => (
                    <button
                      key={`${item.id}-${item.skuCode}`}
                      type="button"
                      onClick={() => onTrackedSkuChange(item.skuCode)}
                      className="rounded-full border border-[var(--color-border)] bg-white px-3 py-2 text-xs font-medium text-[var(--color-primary)] transition hover:border-[var(--color-primary)]"
                    >
                      {item.skuCode} - số lượng {item.quantity}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <Timeline
              className="!mt-2"
              items={trackingSteps.map((step, index) => ({
                color: resolveTimelineColor(step.status),
                children: (
                  <div className="pb-3">
                    <div className="text-base font-semibold text-[var(--color-primary)]">{step.title}</div>
                    <Paragraph className="!mb-0 !mt-1 text-sm leading-7 !text-[var(--color-secondary)]">
                      {buildStepDescription(
                        index,
                        step.description,
                        order,
                        reservation,
                        relatedSaga,
                        pendingSession,
                      )}
                    </Paragraph>
                  </div>
                ),
              }))}
            />

            <div className="rounded-[24px] border border-[var(--color-border)] bg-white px-5 py-5">
              <div className="text-sm font-semibold text-[var(--color-primary)]">Tóm tắt bằng chứng đang hiển thị</div>
              <div className="mt-3 space-y-2 text-sm leading-7 text-[var(--color-secondary)]">
                <div>
                  Trạng thái đơn hàng: {order ? orderTag(order.status) : <Tag>Đang chờ</Tag>}.
                </div>
                <div>
                  Giữ chỗ theo đơn: {getReservationTag(reservation?.state)}{" "}
                  {reservation?.expiresAtMs ? `| hết hạn lúc ${formatMillis(reservation.expiresAtMs)}` : ""}
                </div>
                <div>
                  Luồng điều phối: {relatedSaga ? sagaTag(relatedSaga.status) : <Tag>Chưa thấy</Tag>}{" "}
                  {relatedSaga?.currentStep ? `| bước ${resolveSagaStepLabel(relatedSaga.currentStep)}` : ""}
                </div>
                {pendingSession ? (
                  <div>
                    Phiên chờ phản hồi đang đợi {pendingSession.receivedItems}/{pendingSession.totalItems} kết quả, tuổi phiên{" "}
                    {formatDurationMs(pendingSession.ageMs)}.
                  </div>
                ) : null}
              </div>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
