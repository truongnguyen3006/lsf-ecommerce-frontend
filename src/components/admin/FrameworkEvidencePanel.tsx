"use client";

import type { ReactNode } from "react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
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
import { getOrderStatusMeta } from "@/lib/order-status";
import {
  inventoryApi,
  type InventoryAvailabilityResponse,
  type OrderReservationSummaryResponse,
} from "@/services/inventoryApi";
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

function resolveSagaFailureReasonText(failureReason?: string) {
  const normalized = (failureReason || "").trim().toUpperCase();

  if (!normalized) {
    return "";
  }

  if (normalized.includes("DECLINED")) {
    return "Cổng thanh toán đã từ chối giao dịch.";
  }

  if (normalized.includes("TIMEOUT")) {
    return "Yêu cầu đã quá thời gian chờ xử lý.";
  }

  if (
    normalized.includes("OUT_OF_STOCK") ||
    normalized.includes("INSUFFICIENT") ||
    normalized.includes("INVENTORY") ||
    normalized.includes("STOCK")
  ) {
    return "Không đủ tồn kho để tiếp tục đơn hàng.";
  }

  return failureReason || "";
}

function resolveSagaStepLabel(step?: string) {
  if (!step) {
    return "";
  }

  if (step === "inventoryValidation") {
    return "kiểm tra tồn kho";
  }

  if (step === "paymentProcessing") {
    return "thanh toán";
  }

  return step;
}

function resolveOutboxEventLabel(eventType?: string) {
  switch (eventType) {
    case "ecommerce.order.status.v1":
      return "Cập nhật trạng thái đơn hàng";
    case "inventory.reservation.confirm.v1":
    case "ConfirmReservationCommand":
      return "Xác nhận giữ chỗ tồn kho";
    case "inventory.reservation.release.v1":
    case "ReleaseReservationCommand":
      return "Giải phóng giữ chỗ tồn kho";
    case "inventory.reservation.request.v1":
    case "inventory.reservation.reserve.v1":
    case "ReserveReservationCommand":
      return "Yêu cầu giữ chỗ tồn kho";
    case "payment.processed.v1":
      return "Ghi nhận thanh toán thành công";
    case "payment.failed.v1":
      return "Ghi nhận thanh toán thất bại";
    case "order.validated.v1":
      return "Chuyển sang bước thanh toán";
    default:
      return eventType || "Sự kiện hệ thống";
  }
}

type OutboxNarrative = {
  title: string;
  summary: string;
  detail?: string;
  badgeLabel?: string;
  badgeColor?: string;
};

const completedOutboxStatuses = new Set(["COMPLETED", "DELIVERED", "SHIPPING", "CONFIRMED"]);
const failedOutboxStatuses = new Set(["FAILED", "PAYMENT_FAILED", "CANCELLED"]);

function resolveOutboxEventSummary(row: OutboxVisibilityRow) {
  const eventType = row.eventType || "";
  const skuToken = row.msgKey || row.aggregateId || "";
  const orderToken = row.correlationId || "";

  if (eventType === "ecommerce.order.status.v1") {
    return orderToken ? `Đơn liên quan: ${orderToken}` : "Sự kiện cập nhật trạng thái của đơn hàng.";
  }

  if (
    eventType === "inventory.reservation.confirm.v1" ||
    eventType === "ConfirmReservationCommand" ||
    eventType === "inventory.reservation.release.v1" ||
    eventType === "ReleaseReservationCommand" ||
    eventType === "inventory.reservation.request.v1" ||
    eventType === "inventory.reservation.reserve.v1" ||
    eventType === "ReserveReservationCommand"
  ) {
    return skuToken ? `SKU liên quan: ${skuToken}` : "Sự kiện thao tác trên phần giữ chỗ tồn kho.";
  }

  if (eventType === "payment.processed.v1") {
    return orderToken ? `Đơn liên quan: ${orderToken}` : "Sự kiện thông báo kết quả thanh toán.";
  }

  return row.topic || "Sự kiện dùng để đồng bộ giữa các dịch vụ.";
}

function resolveReservationOutcomeText(reservationState?: string) {
  switch (normalizeToken(reservationState)) {
    case "CONFIRMED":
      return "Phần giữ chỗ ở tồn kho cũng đã được xác nhận ở dòng riêng.";
    case "RELEASED":
      return "Phần giữ chỗ ở tồn kho đã được trả lại ở dòng riêng.";
    case "EXPIRED":
      return "Phần giữ chỗ ở tồn kho đã hết hạn và được trả lại.";
    default:
      return "";
  }
}

function resolveGenericOutboxNarrative(
  row: OutboxVisibilityRow,
  reservationState?: string,
): OutboxNarrative {
  const skuToken = row.msgKey || row.aggregateId || "";
  const orderToken = row.correlationId || "";

  switch (row.eventType) {
    case "inventory.reservation.confirm.v1":
    case "ConfirmReservationCommand":
      return {
        title: "Xác nhận giữ chỗ tồn kho",
        summary: skuToken
          ? `SKU ${skuToken} đã được chốt lại cho đơn hàng sau khi đi hết nhánh thành công.`
          : "Hệ thống xác nhận phần giữ chỗ ở tồn kho cho đơn thành công.",
        detail: skuToken ? `SKU: ${skuToken}` : undefined,
        badgeLabel: "Nhánh thành công",
        badgeColor: "green",
      };
    case "inventory.reservation.release.v1":
    case "ReleaseReservationCommand":
      return {
        title: "Giải phóng giữ chỗ tồn kho",
        summary: skuToken
          ? `SKU ${skuToken} được trả lại vì đơn không hoàn tất hoặc đã quá hạn thanh toán.`
          : "Hệ thống trả lại phần đã giữ chỗ vì đơn không tiếp tục được.",
        detail: skuToken ? `SKU: ${skuToken}` : undefined,
        badgeLabel: "Nhánh hoàn lại",
        badgeColor: "magenta",
      };
    case "inventory.reservation.request.v1":
    case "inventory.reservation.reserve.v1":
    case "ReserveReservationCommand":
      return {
        title: "Yêu cầu giữ chỗ tồn kho",
        summary: skuToken
          ? `Hệ thống gửi yêu cầu giữ chỗ cho SKU ${skuToken}.`
          : "Hệ thống bắt đầu bước giữ chỗ ở tồn kho.",
        detail: skuToken ? `SKU: ${skuToken}` : undefined,
        badgeLabel: "Bắt đầu giữ chỗ",
        badgeColor: "blue",
      };
    case "order.validated.v1":
      return {
        title: "Chuyển sang bước thanh toán",
        summary: orderToken
          ? `Đơn ${orderToken} đã giữ chỗ xong và được chuyển sang bước chờ xử lý thanh toán.`
          : "Đơn đã giữ chỗ xong và được chuyển sang bước thanh toán.",
        detail: orderToken ? `Đơn: ${orderToken}` : undefined,
        badgeLabel: "Sau giữ chỗ",
        badgeColor: "blue",
      };
    case "payment.processed.v1":
      return {
        title: "Ghi nhận thanh toán thành công",
        summary: orderToken
          ? `Hệ thống đã nhận tín hiệu thanh toán thành công cho đơn ${orderToken}.`
          : "Hệ thống đã nhận tín hiệu thanh toán thành công.",
        detail: orderToken ? `Đơn: ${orderToken}` : undefined,
        badgeLabel: "Thanh toán OK",
        badgeColor: "green",
      };
    case "payment.failed.v1":
      return {
        title: "Ghi nhận thanh toán thất bại",
        summary: orderToken
          ? `Hệ thống đã nhận tín hiệu thanh toán thất bại hoặc quá hạn cho đơn ${orderToken}.`
          : "Hệ thống đã nhận tín hiệu thanh toán thất bại hoặc quá hạn.",
        detail: orderToken ? `Đơn: ${orderToken}` : undefined,
        badgeLabel: "Thanh toán lỗi",
        badgeColor: "red",
      };
    default:
      return {
        title: resolveOutboxEventLabel(row.eventType),
        summary:
          resolveOutboxEventSummary(row) ||
          resolveReservationOutcomeText(reservationState) ||
          "Sự kiện dùng để đồng bộ giữa các dịch vụ.",
      };
  }
}

function buildOrderStatusNarrative(
  index: number,
  total: number,
  finalStatus?: string,
  reservationState?: string,
): OutboxNarrative {
  const stepBadge = `Mốc ${index + 1}/${total}`;
  const normalizedFinalStatus = normalizeToken(finalStatus);
  const finalStatusMeta = finalStatus ? getOrderStatusMeta(finalStatus) : undefined;
  const reservationHint = resolveReservationOutcomeText(reservationState);

  if (total <= 1) {
    if (completedOutboxStatuses.has(normalizedFinalStatus)) {
      return {
        title: "Đơn hàng hoàn tất",
        summary:
          reservationHint ||
          "Đơn đã đi hết nhánh thành công. Việc xác nhận giữ chỗ sẽ hiển thị ở dòng riêng.",
        detail: finalStatusMeta ? `Trạng thái cuối: ${finalStatusMeta.label}` : undefined,
        badgeLabel: "Mốc cuối",
        badgeColor: "green",
      };
    }

    if (failedOutboxStatuses.has(normalizedFinalStatus)) {
      return {
        title: "Đơn hàng không hoàn tất",
        summary:
          reservationHint ||
          "Đơn đã đi sang nhánh lỗi hoặc quá hạn. Việc trả lại giữ chỗ sẽ hiển thị ở dòng riêng.",
        detail: finalStatusMeta ? `Trạng thái cuối: ${finalStatusMeta.label}` : undefined,
        badgeLabel: "Mốc cuối",
        badgeColor: finalStatusMeta?.color || "red",
      };
    }
  }

  if (index === 0) {
    return {
      title: "Tiếp nhận đơn hàng",
      summary: "Đơn đã được tạo và bắt đầu luồng xử lý.",
      detail: "Bước mở đầu của luồng đơn hàng",
      badgeLabel: stepBadge,
      badgeColor: "gold",
    };
  }

  if (index === total - 1) {
    if (completedOutboxStatuses.has(normalizedFinalStatus)) {
      return {
        title: "Đơn hàng hoàn tất",
        summary:
          reservationHint ||
          "Đơn đã đi hết nhánh thành công. Việc xác nhận giữ chỗ sẽ hiển thị ở dòng riêng.",
        detail: finalStatusMeta ? `Trạng thái cuối: ${finalStatusMeta.label}` : undefined,
        badgeLabel: stepBadge,
        badgeColor: "green",
      };
    }

    if (failedOutboxStatuses.has(normalizedFinalStatus)) {
      return {
        title: "Đơn hàng không hoàn tất",
        summary:
          reservationHint ||
          "Đơn đã đi sang nhánh lỗi hoặc quá hạn. Việc trả lại giữ chỗ sẽ hiển thị ở dòng riêng.",
        detail: finalStatusMeta ? `Trạng thái cuối: ${finalStatusMeta.label}` : undefined,
        badgeLabel: stepBadge,
        badgeColor: finalStatusMeta?.color || "red",
      };
    }

    if (normalizedFinalStatus === "VALIDATED") {
      return {
        title: "Đang chờ thanh toán",
        summary: "Đơn đã giữ chỗ xong và đang ở trong thời gian chờ xử lý thanh toán.",
        detail: finalStatusMeta ? `Trạng thái hiện tại: ${finalStatusMeta.label}` : undefined,
        badgeLabel: stepBadge,
        badgeColor: "blue",
      };
    }
  }

  return {
    title: "Đã giữ chỗ tồn kho",
    summary: "Tồn kho đã được giữ chỗ cho đơn và hệ thống chuyển sang bước chờ thanh toán.",
    detail: "Bước trung gian sau khi giữ chỗ thành công",
    badgeLabel: stepBadge,
    badgeColor: "blue",
  };
}

type OrderScenarioFilterKey =
  | "all"
  | "completed"
  | "unfinished"
  | "overdue-or-intermediate"
  | "failure-or-compensation";

interface OrderOptionSignal {
  value: string;
  label: ReactNode;
  sortPriority: number;
  matchesFilter?: boolean;
  orderDateMs?: number;
}

const orderScenarioFilterOptions: Array<{ value: OrderScenarioFilterKey; label: string }> = [
  { value: "all", label: "Đơn gần đây" },
  { value: "completed", label: "Đơn thành công" },
  { value: "unfinished", label: "Chưa hoàn tất" },
  { value: "overdue-or-intermediate", label: "Quá hạn / trung gian" },
  { value: "failure-or-compensation", label: "Lỗi / bù trừ" },
];

const intermediateOrderStatuses = new Set(["PENDING", "VALIDATED"]);
const completedOrderStatuses = new Set(["COMPLETED", "DELIVERED"]);
const unfinishedOrderStatuses = new Set(["PENDING", "VALIDATED", "FAILED", "PAYMENT_FAILED"]);
const activeSagaStatuses = new Set(["WAITING", "RUNNING", "COMPENSATING", "TIMED_OUT"]);

const QUERY_STALE_MS = 30_000;

export default function FrameworkEvidencePanel() {
  const [activeSection, setActiveSection] = useState<FrameworkSectionKey>("workflow");
  const [orderScenarioFilter, setOrderScenarioFilter] =
    useState<OrderScenarioFilterKey>("all");
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
    enabled: Boolean(deferredTrackedOrderInput),
    staleTime: QUERY_STALE_MS,
    retry: 0,
  });

  const orderReservationQuery = useQuery<OrderReservationSummaryResponse>({
    queryKey: ["ops-order-reservation", deferredTrackedOrderInput],
    queryFn: () => inventoryApi.getOrderReservation(deferredTrackedOrderInput),
    enabled: Boolean(deferredTrackedOrderInput),
    staleTime: 5_000,
    retry: 0,
  });

  const skuQuery = useQuery<VisibilitySkuOption[]>({
    queryKey: ["ops-skus"],
    queryFn: () => operationsVisibilityApi.getSkuOptions(),
    enabled: reservationActive,
    staleTime: QUERY_STALE_MS,
  });

  const focusedOrder = trackedOrderDetailQuery.data || orderFromList;
  const focusedOrderSkuItems = useMemo(
    () =>
      (focusedOrder?.orderLineItemsList || []).map((item) => ({
        id: String(item.id ?? item.skuCode),
        skuCode: item.skuCode,
        quantity: item.quantity,
      })),
    [focusedOrder],
  );
  const reservationSkuItems = useMemo(() => {
    const aggregated = new Map<string, number>();

    (orderReservationQuery.data?.items || []).forEach((item) => {
      aggregated.set(item.skuCode, (aggregated.get(item.skuCode) || 0) + item.quantity);
    });

    return Array.from(aggregated.entries()).map(([skuCode, quantity]) => ({
      id: skuCode,
      skuCode,
      quantity,
    }));
  }, [orderReservationQuery.data?.items]);
  const displayedOrderSkuItems = useMemo(() => {
    if (reservationSkuItems.length > 0 && focusedOrderSkuItems.length > 0) {
      const orderSkuSet = new Set(focusedOrderSkuItems.map((item) => normalizeToken(item.skuCode)));
      const matchedReservationSkuItems = reservationSkuItems.filter((item) =>
        orderSkuSet.has(normalizeToken(item.skuCode)),
      );

      if (matchedReservationSkuItems.length > 0) {
        return matchedReservationSkuItems;
      }
    }

    if (reservationSkuItems.length > 0) {
      return reservationSkuItems;
    }

    return focusedOrderSkuItems;
  }, [focusedOrderSkuItems, reservationSkuItems]);
  const displayOrderForPanels = useMemo(() => {
    if (!focusedOrder) {
      return focusedOrder;
    }

    if (displayedOrderSkuItems.length === 0) {
      return focusedOrder;
    }

    const lineItemBySku = new Map(
      (focusedOrder.orderLineItemsList || []).map((item) => [item.skuCode, item]),
    );

    return {
      ...focusedOrder,
      orderLineItemsList: displayedOrderSkuItems.map((displayItem) => {
        const matchedItem = lineItemBySku.get(displayItem.skuCode);

        return {
          id: matchedItem?.id ?? displayItem.id,
          skuCode: displayItem.skuCode,
          price: matchedItem?.price ?? 0,
          quantity: displayItem.quantity,
          productName: matchedItem?.productName ?? displayItem.skuCode,
          color: matchedItem?.color ?? "",
          size: matchedItem?.size ?? "",
        };
      }),
    };
  }, [displayedOrderSkuItems, focusedOrder]);
  const focusedOrderSkuOptions = useMemo(
    () => uniqueStrings(displayedOrderSkuItems.map((item) => item.skuCode)),
    [displayedOrderSkuItems],
  );
  const hasTrackedOrder = Boolean(deferredTrackedOrderInput);

  const matchedOrderSku = useMemo(
    () =>
      focusedOrderSkuOptions.find(
        (skuCode) => normalizeToken(skuCode) === normalizeToken(selectedSku),
      ) || "",
    [focusedOrderSkuOptions, selectedSku],
  );

  const orderBoundSku = matchedOrderSku || focusedOrderSkuOptions[0] || "";

  const displayedTrackedSku = orderBoundSku || selectedSku;
  const effectiveSku = hasTrackedOrder ? orderBoundSku || selectedSku : "";
  const focusedReservationState = orderReservationQuery.data?.state;

  useEffect(() => {
    if (!hasTrackedOrder) {
      if (selectedSku) {
        setSelectedSku("");
      }
      return;
    }

    if (focusedOrderSkuOptions.length === 0) {
      if (selectedSku) {
        setSelectedSku("");
      }
      return;
    }

    const hasMatchedSku = focusedOrderSkuOptions.some(
      (skuCode) => normalizeToken(skuCode) === normalizeToken(selectedSku),
    );

    if (!hasMatchedSku) {
      setSelectedSku(focusedOrderSkuOptions[0]);
    }
  }, [focusedOrderSkuOptions, hasTrackedOrder, selectedSku]);

  const availabilityQuery = useQuery<InventoryAvailabilityResponse>({
    queryKey: ["ops-availability", effectiveSku],
    queryFn: () => inventoryApi.getAvailability(effectiveSku),
    enabled: reservationActive && hasTrackedOrder && Boolean(effectiveSku),
    staleTime: QUERY_STALE_MS,
    retry: 0,
  });

  const outboxQuery = useQuery<OutboxVisibilityRow[]>({
    queryKey: ["ops-outbox", effectiveOutboxFilter, deferredTrackedOrderInput],
    queryFn: async () => {
      if (effectiveOutboxFilter) {
        return operationsVisibilityApi.getOutboxRows({
          limit: 20,
          msgKey: effectiveOutboxFilter,
        });
      }

      if (deferredTrackedOrderInput) {
        return operationsVisibilityApi.getOutboxRows({
          limit: 20,
          correlationId: deferredTrackedOrderInput,
        });
      }

      return [];
    },
    enabled: outboxActive,
    staleTime: 15_000,
    retry: 1,
  });

  const orderStatusByOrderToken = useMemo(() => {
    const statusMap = new Map<string, string>();

    recentOrders.forEach((order) => {
      const orderToken = normalizeToken(order.orderNumber);
      if (orderToken) {
        statusMap.set(orderToken, order.status);
      }
    });

    if (focusedOrder?.orderNumber) {
      statusMap.set(normalizeToken(focusedOrder.orderNumber), focusedOrder.status);
    }

    return statusMap;
  }, [focusedOrder, recentOrders]);

  const outboxNarratives = useMemo(() => {
    const narrativeMap = new Map<string, OutboxNarrative>();
    const orderStatusGroups = new Map<string, OutboxVisibilityRow[]>();

    (outboxQuery.data || []).forEach((row) => {
      if (!row.eventId) {
        return;
      }

      if (row.eventType === "ecommerce.order.status.v1") {
        const groupKey = normalizeToken(row.correlationId || row.msgKey || row.aggregateId || row.eventId);
        const currentRows = orderStatusGroups.get(groupKey) || [];
        currentRows.push(row);
        orderStatusGroups.set(groupKey, currentRows);
        return;
      }

      narrativeMap.set(row.eventId, resolveGenericOutboxNarrative(row, focusedReservationState));
    });

    orderStatusGroups.forEach((rows, orderToken) => {
      const sortedRows = [...rows].sort((left, right) => {
        const leftTime = new Date(left.createdAt || left.sentAt || 0).getTime();
        const rightTime = new Date(right.createdAt || right.sentAt || 0).getTime();

        if (leftTime !== rightTime) {
          return leftTime - rightTime;
        }

        return left.id - right.id;
      });

      const finalStatus = orderStatusByOrderToken.get(orderToken);
      const reservationStateForOrder =
        normalizeToken(focusedOrder?.orderNumber) === orderToken ? focusedReservationState : undefined;

      sortedRows.forEach((row, index) => {
        narrativeMap.set(
          row.eventId,
          buildOrderStatusNarrative(index, sortedRows.length, finalStatus, reservationStateForOrder),
        );
      });
    });

    return narrativeMap;
  }, [
    focusedOrder?.orderNumber,
    focusedReservationState,
    orderStatusByOrderToken,
    outboxQuery.data,
  ]);

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

  const overdueOrderTokens = useMemo(
    () =>
      new Set(
        (sagaQuery.data?.overdueInstances || [])
          .map((row) => normalizeToken(row.correlationId))
          .filter(Boolean),
      ),
    [sagaQuery.data?.overdueInstances],
  );

  const pendingBridgeOrderTokens = useMemo(
    () =>
      new Set(
        (sagaQuery.data?.aggregator.pendingSessions || [])
          .map((row) => normalizeToken(row.orderNumber))
          .filter(Boolean),
      ),
    [sagaQuery.data?.aggregator.pendingSessions],
  );

  const failureOrderTokens = useMemo(
    () =>
      new Set(
        (sagaQuery.data?.recentFailures || [])
          .map((row) => normalizeToken(row.correlationId))
          .filter(Boolean),
      ),
    [sagaQuery.data?.recentFailures],
  );

  const compensationOrderTokens = useMemo(
    () =>
      new Set(
        (sagaQuery.data?.recentCompensations || [])
          .map((row) => normalizeToken(row.correlationId))
          .filter(Boolean),
      ),
    [sagaQuery.data?.recentCompensations],
  );

  const activeSagaOrderTokens = useMemo(
    () =>
      new Set(
        sagaCatalog
          .filter((row) => activeSagaStatuses.has(row.status))
          .map((row) => normalizeToken(row.correlationId))
          .filter(Boolean),
      ),
    [sagaCatalog],
  );

  const hasFocusedFailures = filteredRecentFailures.length > 0;
  const hasFocusedCompensations = filteredRecentCompensations.length > 0;
  const hasFocusedOverdueInstances = filteredOverdueInstances.length > 0;
  const hasFocusedPendingSessions = filteredPendingSessions.length > 0;
  const hasAnyFocusedFailureSignal =
    hasFocusedFailures ||
    hasFocusedCompensations ||
    hasFocusedOverdueInstances ||
    hasFocusedPendingSessions;
  const focusedFailureTopRowSpan = hasFocusedFailures && hasFocusedCompensations ? 12 : 24;
  const focusedFailureBottomRowSpan =
    hasFocusedOverdueInstances && hasFocusedPendingSessions ? 12 : 24;

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
  const outboxRowMatchesFocus = (row: OutboxVisibilityRow) =>
    Boolean(deferredTrackedOrder && outboxMatchesOrder(row, deferredTrackedOrder));

  const filteredOrderSignals = useMemo<OrderOptionSignal[]>(() => {
    return recentOrders
      .map((row) => {
        const orderToken = normalizeToken(row.orderNumber);
        const rowSkuItems =
          orderToken === deferredTrackedOrder && displayedOrderSkuItems.length > 0
            ? displayedOrderSkuItems
            : row.orderLineItemsList.map((item) => ({
                id: String(item.id ?? item.skuCode),
                skuCode: item.skuCode,
                quantity: item.quantity,
              }));
        const skuPreview = uniqueStrings(rowSkuItems.map((item) => item.skuCode))
          .slice(0, 3)
          .join(", ");
        const isOverdue = overdueOrderTokens.has(orderToken);
        const hasPendingBridge = pendingBridgeOrderTokens.has(orderToken);
        const hasFailure = failureOrderTokens.has(orderToken) || row.status === "FAILED" || row.status === "PAYMENT_FAILED";
        const hasCompensation = compensationOrderTokens.has(orderToken);
        const isIntermediate = intermediateOrderStatuses.has(row.status) || activeSagaOrderTokens.has(orderToken);

        const matchesFilter =
          orderScenarioFilter === "all" ||
          (orderScenarioFilter === "completed" && completedOrderStatuses.has(row.status)) ||
          (orderScenarioFilter === "unfinished" && unfinishedOrderStatuses.has(row.status)) ||
          (orderScenarioFilter === "overdue-or-intermediate" &&
            (isOverdue || hasPendingBridge || isIntermediate)) ||
          (orderScenarioFilter === "failure-or-compensation" &&
            (hasFailure || hasCompensation));

        const sortPriority = isOverdue
          ? 0
          : hasPendingBridge
            ? 1
            : hasCompensation
              ? 2
              : hasFailure
                ? 3
                : isIntermediate
                  ? 4
                  : 5;

        const badges: ReactNode[] = [];
        if (isOverdue) {
          badges.push(
            <Tag key="overdue" color="red" className="!mr-0">
              Quá hạn
            </Tag>,
          );
        }
        if (hasPendingBridge) {
          badges.push(
            <Tag key="bridge" color="gold" className="!mr-0">
              Phiên chờ
            </Tag>,
          );
        }
        if (hasCompensation) {
          badges.push(
            <Tag key="compensation" color="orange" className="!mr-0">
              Bù trừ
            </Tag>,
          );
        }
        if (hasFailure && !hasCompensation) {
          badges.push(
            <Tag key="failure" color="volcano" className="!mr-0">
              Lỗi
            </Tag>,
          );
        }
        if (isIntermediate && !isOverdue && !hasPendingBridge) {
          badges.push(
            <Tag key="intermediate" color="blue" className="!mr-0">
              Trung gian
            </Tag>,
          );
        }

        return {
          value: row.orderNumber,
          sortPriority,
          matchesFilter,
          orderDateMs: new Date(row.orderDate || 0).getTime(),
          label: (
            <div className="space-y-1 py-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-[var(--color-primary)]">{row.orderNumber}</span>
                {orderTag(row.status)}
                {badges}
              </div>
              <div className="text-xs text-[var(--color-secondary)]">
                {formatDateTime(row.orderDate)}
                {skuPreview ? ` | ${skuPreview}` : ""}
              </div>
            </div>
          ),
        };
      })
      .filter((row) => row.matchesFilter)
      .sort((left, right) => {
        if (orderScenarioFilter === "all") {
          return (right.orderDateMs || 0) - (left.orderDateMs || 0);
        }

        if (left.sortPriority !== right.sortPriority) {
          return left.sortPriority - right.sortPriority;
        }
        return (right.orderDateMs || 0) - (left.orderDateMs || 0);
      });
  }, [
    activeSagaOrderTokens,
    compensationOrderTokens,
    failureOrderTokens,
    orderScenarioFilter,
    overdueOrderTokens,
    pendingBridgeOrderTokens,
    recentOrders,
  ]);

  const orderOptions = useMemo(
    () =>
      filteredOrderSignals.slice(0, 12).map((row) => ({
        value: row.value,
        label: row.label,
      })),
    [filteredOrderSignals],
  );

  const orderFilterHint = useMemo(() => {
    if (recentOrders.length === 0) {
      return "Chưa có đơn hàng nào để theo dõi.";
    }

    if (filteredOrderSignals.length === 0) {
      const currentLabel =
        orderScenarioFilterOptions.find((option) => option.value === orderScenarioFilter)?.label ||
        "Đơn gần đây";
      return `Không có đơn thuộc nhóm "${currentLabel}" trong danh sách gần đây.`;
    }

    return undefined;
  }, [filteredOrderSignals.length, orderScenarioFilter, recentOrders.length]);

  const skuOptions = useMemo(
    () =>
      focusedOrderSkuOptions.map((skuCode) => ({
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

  const handleOrderScenarioFilterChange = (value: string) => {
    setOrderScenarioFilter(value as OrderScenarioFilterKey);
    setTrackedOrderNumber("");
    setSelectedSku("");
  };

  const handleTrackedOrderChange = (value?: string) => {
    const rawOrderNumber = value ? value.trim() : "";
    setTrackedOrderNumber(rawOrderNumber);
    setSelectedSku("");
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

    if (deferredTrackedOrderInput) {
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
        const rowSkuCount =
          isFocused && displayedOrderSkuItems.length > 0
            ? displayedOrderSkuItems.length
            : row.orderLineItemsList.length;
        return (
          <div>
            <div className="flex items-center gap-2">
              <div className="font-medium text-[var(--color-primary)]">{row.orderNumber}</div>
              {isFocused ? <Tag color="gold">Đang theo dõi</Tag> : null}
            </div>
            <div className="text-xs text-[var(--color-secondary)]">
              {rowSkuCount} dòng sản phẩm
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
      title: "Ý nghĩa nghiệp vụ",
      render: (_, row) => {
        const narrative =
          (row.eventId ? outboxNarratives.get(row.eventId) : undefined) ||
          resolveGenericOutboxNarrative(row, focusedReservationState);

        return (
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="font-medium text-[var(--color-primary)]">{narrative.title}</div>
              {narrative.badgeLabel ? (
                <Tag color={narrative.badgeColor || "blue"}>{narrative.badgeLabel}</Tag>
              ) : null}
              {outboxRowMatchesFocus(row) ? (
                <Tag color="gold">Đang theo dõi</Tag>
              ) : null}
            </div>
            <div className="mt-1 text-xs text-[var(--color-secondary)]">
              {row.eventType || "Không rõ loại sự kiện"}
              {narrative.detail ? ` • ${narrative.detail}` : ""}
            </div>
            <div className="mt-1 text-xs leading-6 text-[var(--color-secondary)]">
              {narrative.summary}
            </div>
          </div>
        );
      },
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
            {row.currentStep ? resolveSagaStepLabel(row.currentStep) : "Đã hoàn tất bước bù trừ"}
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
            order={displayOrderForPanels}
            orderLoading={Boolean(deferredTrackedOrderInput) && trackedOrderDetailQuery.isLoading && !focusedOrder}
            orderError={trackedOrderDetailQuery.isError}
            reservation={orderReservationQuery.data}
            reservationLoading={orderReservationQuery.isLoading}
            reservationError={orderReservationQuery.isError}
            relatedSaga={focusedSaga}
            pendingSession={focusedPendingSession}
            hasSagaSnapshot={sagaCatalog.length > 0}
            displaySkuItems={displayedOrderSkuItems}
            onTrackedSkuChange={handleTrackedSkuChange}
          />
        </Col>
      </Row>
    </div>
  );

  const renderFailureSection = () => (
    <Card className="app-admin-card border-0" title="Lỗi, quá hạn và bù trừ">
      {sagaQuery.isLoading ? (
        <div className="flex min-h-[240px] items-center justify-center">
          <Spin />
        </div>
      ) : sagaQuery.isError ? (
        <Alert type="warning" showIcon message="Không tải được dữ liệu saga" />
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
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Phiên chờ phản hồi</div>
                <div className="mt-2 text-2xl font-semibold">{sagaQuery.data.aggregator.pendingCount}</div>
              </div>
            </Col>
          </Row>

          <Descriptions column={{ xs: 1, xl: 2 }} size="small" bordered>
            <Descriptions.Item label="Saga khởi động từ lúc bật dịch vụ">
              {sagaQuery.data.runtimeCounters.sagaStartedSinceBoot}
            </Descriptions.Item>
            <Descriptions.Item label="Saga hoàn tất / bù trừ">
              {sagaQuery.data.runtimeCounters.sagaCompletedSinceBoot +
                sagaQuery.data.runtimeCounters.sagaCompensatedSinceBoot}
            </Descriptions.Item>
            <Descriptions.Item label="Đã quá thời gian chờ">
              {sagaQuery.data.timeoutSummary.timedOutCount}
            </Descriptions.Item>
            <Descriptions.Item label="Bù trừ thất bại">
              {sagaQuery.data.timeoutSummary.compensationFailedCount}
            </Descriptions.Item>
            {sagaQuery.data.aggregator.duplicateStartsIgnoredSinceBoot > 0 ? (
              <Descriptions.Item label="Phiên chờ trùng bị bỏ qua">
                {sagaQuery.data.aggregator.duplicateStartsIgnoredSinceBoot}
              </Descriptions.Item>
            ) : null}
            {sagaQuery.data.aggregator.lateResultsIgnoredSinceBoot > 0 ? (
              <Descriptions.Item label="Phản hồi đến muộn bị bỏ qua">
                {sagaQuery.data.aggregator.lateResultsIgnoredSinceBoot}
              </Descriptions.Item>
            ) : null}
          </Descriptions>

          {(focusedSaga || focusedPendingSession || deferredTrackedOrder) ? (
            <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4">
              <div className="text-sm font-semibold text-amber-900">Tóm tắt theo đơn đang theo dõi</div>
              <div className="mt-2 space-y-2 text-sm leading-7 text-amber-900/80">
                <div>
                  <span className="font-medium text-amber-950">Đơn hàng:</span>{" "}
                  {deferredTrackedOrder || "chưa chọn"}
                </div>
                <div>
                  <span className="font-medium text-amber-950">Luồng khớp:</span>{" "}
                  {focusedSaga ? focusedSaga.sagaId : "Chưa thấy luồng khớp trong dữ liệu hiện tại"}
                </div>
                {focusedSaga?.failureReason ? (
                  <div>
                    <span className="font-medium text-amber-950">Lý do gần nhất:</span>{" "}
                    {resolveSagaFailureReasonText(focusedSaga.failureReason)}
                  </div>
                ) : null}
                {focusedPendingSession ? (
                  <div>
                    <span className="font-medium text-amber-950">Phiên chờ phản hồi:</span>{" "}
                    {`${focusedPendingSession.receivedItems}/${focusedPendingSession.totalItems} phản hồi`}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {deferredTrackedOrder ? (
            hasFocusedFailures || hasFocusedCompensations ? (
              <Row gutter={[16, 16]}>
                {hasFocusedFailures ? (
                  <Col xs={24} xl={focusedFailureTopRowSpan}>
                    <div className="rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-4">
                      <div className="mb-3 text-sm font-semibold text-[var(--color-primary)]">
                        Lỗi của đơn đang theo dõi
                      </div>
                      <Table
                        rowKey={(row) => `failure-${row.sagaId}`}
                        columns={sagaColumns}
                        dataSource={filteredRecentFailures}
                        pagination={false}
                        size="small"
                        scroll={{ x: 680 }}
                        rowClassName={(row) =>
                          matchedSagaIds.has(row.sagaId) ? "framework-demo-row-active" : ""
                        }
                      />
                    </div>
                  </Col>
                ) : null}
                {hasFocusedCompensations ? (
                  <Col xs={24} xl={focusedFailureTopRowSpan}>
                    <div className="rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-4">
                      <div className="mb-3 text-sm font-semibold text-[var(--color-primary)]">
                        Bù trừ của đơn đang theo dõi
                      </div>
                      <Table
                        rowKey={(row) => `comp-${row.sagaId}`}
                        columns={sagaColumns}
                        dataSource={filteredRecentCompensations}
                        pagination={false}
                        size="small"
                        scroll={{ x: 680 }}
                        rowClassName={(row) =>
                          matchedSagaIds.has(row.sagaId) ? "framework-demo-row-active" : ""
                        }
                      />
                    </div>
                  </Col>
                ) : null}
              </Row>
            ) : null
          ) : null}

          {deferredTrackedOrder ? (
            hasFocusedOverdueInstances || hasFocusedPendingSessions ? (
              <Row gutter={[16, 16]}>
                {hasFocusedOverdueInstances ? (
                  <Col xs={24} xl={focusedFailureBottomRowSpan}>
                    <div className="rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-4">
                      <div className="mb-3 text-sm font-semibold text-[var(--color-primary)]">
                        Dấu hiệu quá hạn của đơn đang theo dõi
                      </div>
                      <Table
                        rowKey={(row) => `overdue-${row.sagaId}`}
                        columns={sagaColumns}
                        dataSource={filteredOverdueInstances}
                        pagination={false}
                        size="small"
                        scroll={{ x: 680 }}
                        rowClassName={(row) =>
                          matchedSagaIds.has(row.sagaId) ? "framework-demo-row-active" : ""
                        }
                      />
                    </div>
                  </Col>
                ) : null}
                {hasFocusedPendingSessions ? (
                  <Col xs={24} xl={focusedFailureBottomRowSpan}>
                    <div className="rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-4">
                      <div className="mb-3 text-sm font-semibold text-[var(--color-primary)]">
                        Phiên chờ của đơn đang theo dõi
                      </div>
                      <Table
                        rowKey={(row) => `bridge-${row.orderNumber}`}
                        columns={pendingSessionColumns}
                        dataSource={filteredPendingSessions}
                        pagination={false}
                        size="small"
                        scroll={{ x: 680 }}
                        rowClassName={(row) =>
                          pendingSessionMatchesOrder(row, deferredTrackedOrder)
                            ? "framework-demo-row-active"
                            : ""
                        }
                      />
                    </div>
                  </Col>
                ) : null}
              </Row>
            ) : null
          ) : null}

          {deferredTrackedOrder && !hasAnyFocusedFailureSignal ? (
            <div className="rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-6">
              <Empty
                description="Đơn đang theo dõi hiện chưa có dữ liệu lỗi, bù trừ, quá hạn hoặc phiên chờ cần chú ý"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            </div>
          ) : null}
        </div>
      ) : (
        <Empty description="Chưa có dữ liệu saga" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}
    </Card>
  );

  const renderReservationSection = () => (
    hasTrackedOrder ? (
      <ReservationEvidencePanel
        trackedOrderNumber={deferredTrackedOrderInput}
        trackedSku={effectiveSku}
        availability={availabilityQuery.data}
        loading={availabilityQuery.isLoading}
        error={availabilityQuery.isError}
        reservation={orderReservationQuery.data}
        reservationLoading={orderReservationQuery.isLoading}
        reservationError={orderReservationQuery.isError}
        quickSkuOptions={focusedOrderSkuOptions}
        onTrackedSkuChange={handleTrackedSkuChange}
      />
    ) : (
      <Card className="app-admin-card border-0" title="Giữ chỗ và tồn khả dụng">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Chọn đơn hàng trước để xem dữ liệu giữ chỗ và tồn khả dụng theo SKU."
        />
      </Card>
    )
  );

  const renderOutboxSection = () => (
    <div className="space-y-4">
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <div className="flex h-full min-h-[152px] flex-col rounded-[24px] border border-[var(--color-border)] bg-white px-5 py-5 shadow-[var(--shadow-soft)]">
            <div className="flex items-center gap-3">
              <DatabaseOutlined className="text-lg text-[var(--color-primary)]" />
              <div className="text-sm font-semibold text-[var(--color-primary)]">Dòng sự kiện đang thấy</div>
            </div>
            <div className="mt-4 text-3xl font-semibold text-[var(--color-primary)]">
              {outboxQuery.data?.length || 0}
            </div>
            <div className="mt-2 text-sm text-[var(--color-secondary)]">
              {outboxFilter
                ? `Đang lọc theo message key: ${outboxFilter}`
                : deferredTrackedOrder
                  ? `Các dòng gắn với đơn ${deferredTrackedOrder} và các sự kiện liên quan`
                  : "Chọn đơn hàng để xem các dòng sự kiện liên quan"}
            </div>
          </div>
        </Col>
        <Col xs={24} md={8}>
          <div className="flex h-full min-h-[152px] flex-col rounded-[24px] border border-[var(--color-border)] bg-white px-5 py-5 shadow-[var(--shadow-soft)]">
            <div className="flex items-center gap-3">
              <ApiOutlined className="text-lg text-[var(--color-primary)]" />
              <div className="text-sm font-semibold text-[var(--color-primary)]">Tình trạng phát sự kiện</div>
            </div>
            <div className="mt-4 text-3xl font-semibold text-[var(--color-primary)]">{outboxHealth.sent}</div>
            <div className="mt-2 text-sm text-[var(--color-secondary)]">
              Đã gửi / {outboxHealth.retrying} đang thử lại / {outboxHealth.failed} lỗi
            </div>
          </div>
        </Col>
        <Col xs={24} md={8}>
          <div className="flex h-full min-h-[152px] flex-col rounded-[24px] border border-[var(--color-border)] bg-white px-5 py-5 shadow-[var(--shadow-soft)]">
            <div className="flex items-center gap-3">
              <LineChartOutlined className="text-lg text-[var(--color-primary)]" />
              <div className="text-sm font-semibold text-[var(--color-primary)]">Bản ghi lỗi Kafka</div>
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
        <Col xs={24} xl={15}>
          <Card className="app-admin-card border-0" title="Dòng sự kiện (Outbox)">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {deferredTrackedOrder ? (
                  <Tag color={outboxFilter ? "default" : "gold"}>
                    Đơn đang theo dõi: {deferredTrackedOrder}
                  </Tag>
                ) : null}
                {outboxFilter ? <Tag color="blue">Message key đang lọc: {outboxFilter}</Tag> : null}
            
                {outboxFilter ? (
                  <Button size="small" onClick={resetOutboxManualFilter}>
                    Bỏ lọc
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
                <Alert type="warning" showIcon message="Chưa truy cập được dữ liệu outbox" />
              ) : (outboxQuery.data || []).length === 0 ? (
                <Empty
                  description={
                    effectiveOutboxFilter
                      ? "Chưa thấy dòng outbox nào khớp với message key đang lọc"
                      : deferredTrackedOrder
                        ? "Chưa thấy dòng sự kiện nào gắn với đơn đang theo dõi"
                        : "Chọn đơn hàng để xem dòng sự kiện hoặc nhập message key để lọc"
                  }
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ) : (
                <Table
                  className="framework-outbox-table"
                  rowKey={(row) => `${row.id}-${row.eventId}`}
                  columns={outboxColumns}
                  dataSource={outboxQuery.data}
                  pagination={false}
                  size="small"
                  scroll={{ x: 760 }}
                  rowClassName={(row) =>
                    `framework-outbox-row${outboxRowMatchesFocus(row) ? " framework-demo-row-active" : ""}`
                  }
                  expandable={{
                    expandedRowRender: (row) => (
                      <div className="space-y-2 text-sm text-[var(--color-secondary)]">
                        <div>
                          <span className="font-medium text-[var(--color-primary)]">Event ID:</span>{" "}
                          {row.eventId}
                        </div>
                        <div>
                          <span className="font-medium text-[var(--color-primary)]">Workflow:</span>{" "}
                          {row.correlationId || "—"}
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

        <Col xs={24} xl={9}>
          <Card className="app-admin-card border-0" title="Kafka Admin / DLQ">
            <div className="space-y-4">
              {kafkaIndexQuery.isError ? (
                <Alert type="warning" showIcon message="Không tải được dữ liệu Kafka Admin" />
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
                <Empty description="Chưa có topic DLQ nào được trả về" image={Empty.PRESENTED_IMAGE_SIMPLE} />
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
                        ? "Xem nội dung bản ghi đang theo dõi"
                        : "Xem nội dung bản ghi mẫu",
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
        title="Tín hiệu vận hành"
        extra={
          runtimeSummary.total > 0 ? (
            <Tag color={runtimeSummary.healthy === runtimeSummary.total ? "green" : "gold"}>
              {runtimeSummary.healthy}/{runtimeSummary.total} dịch vụ hoạt động
            </Tag>
          ) : null
        }
      >
        {runtimeQuery.isLoading ? (
          <div className="flex min-h-[240px] items-center justify-center">
            <Spin />
          </div>
        ) : runtimeQuery.isError ? (
          <Alert type="warning" showIcon message="Các tín hiệu vận hành hiện chưa truy cập được" />
        ) : (runtimeQuery.data || []).length === 0 ? (
          <Empty description="Chưa có dữ liệu vận hành" image={Empty.PRESENTED_IMAGE_SIMPLE} />
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
                        <Tag>Không có chi tiết thành phần</Tag>
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
        orderFilter={orderScenarioFilter}
        orderFilterOptions={orderScenarioFilterOptions}
        orderFilterHint={orderFilterHint}
        trackedOrderNumber={trackedOrderNumber}
        hasTrackedOrder={hasTrackedOrder}
        orderOptions={orderOptions}
        trackedSku={displayedTrackedSku}
        skuOptions={skuOptions}
        lockTrackedSku={focusedOrderSkuOptions.length > 0}
        onSectionChange={handleSectionChange}
        onOrderFilterChange={handleOrderScenarioFilterChange}
        onTrackedOrderChange={handleTrackedOrderChange}
        onTrackedSkuChange={handleTrackedSkuChange}
        onRefreshAll={refreshAll}
      />

      {activeSectionContent}
    </div>
  );
}
