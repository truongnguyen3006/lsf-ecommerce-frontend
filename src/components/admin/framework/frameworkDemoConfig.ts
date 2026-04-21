export type FrameworkSectionKey =
  | "workflow"
  | "failure"
  | "reservation"
  | "outbox"
  | "runtime";

export interface FrameworkSectionConfig {
  key: FrameworkSectionKey;
  label: string;
  eyebrow: string;
  description: string;
}

export const frameworkSections: FrameworkSectionConfig[] = [
  {
    key: "workflow",
    label: "Luồng xử lý",
    eyebrow: "Theo dõi đơn hàng",
    description: "Theo dõi một đơn từ lúc tiếp nhận, giữ chỗ, chờ thanh toán đến trạng thái cuối.",
  },
  {
    key: "failure",
    label: "Lỗi và bù trừ",
    eyebrow: "Quá hạn và bù trừ",
    description: "Tập trung vào lỗi, quá hạn, bù trừ và các phiên đang chờ phản hồi.",
  },
  {
    key: "reservation",
    label: "Giữ chỗ và tồn khả dụng",
    eyebrow: "Tồn khả dụng",
    description: "Giải thích rõ đã giữ chỗ, đã xác nhận, đã trả lại và phần còn có thể bán.",
  },
  {
    key: "outbox",
    label: "Dòng sự kiện",
    eyebrow: "Outbox và DLQ",
    description: "Theo dõi các bản ghi phát sự kiện và các tín hiệu cần xử lý lại.",
  },
  {
    key: "runtime",
    label: "Tín hiệu vận hành",
    eyebrow: "Sức khỏe và chỉ số",
    description: "Cho thấy hệ thống đang chạy thật qua sức khỏe dịch vụ và các chỉ số chính.",
  },
];
