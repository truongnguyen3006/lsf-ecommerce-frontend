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
    label: "Workflow",
    eyebrow: "Theo dấu đơn hàng",
    description: "Theo dõi một đơn từ lúc tiếp nhận đến trạng thái điều phối hiện tại.",
  },
  {
    key: "failure",
    label: "Lỗi & Bù trừ",
    eyebrow: "Saga và timeout",
    description: "Tập trung vào lỗi, bù trừ, timeout và bridge đang chờ.",
  },
  {
    key: "reservation",
    label: "Reservation / Chống oversell",
    eyebrow: "Availability",
    description: "Giải thích rõ tồn vật lý, đã giữ chỗ, đã xác nhận và còn có thể bán.",
  },
  {
    key: "outbox",
    label: "Outbox & Kafka Admin",
    eyebrow: "Phát sự kiện",
    description: "Kiểm tra outbox, DLQ, topic và tín hiệu drain.",
  },
  {
    key: "runtime",
    label: "Runtime",
    eyebrow: "Health và metrics",
    description: "Chốt demo bằng tín hiệu runtime thật và liên kết vận hành.",
  },
];
