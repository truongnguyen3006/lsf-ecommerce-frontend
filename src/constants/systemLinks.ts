export interface SystemLinkItem {
  key: "grafana" | "zipkin" | "prometheus" | "phpmyadmin" | "gatewayHealth";
  label: string;
  description: string;
  url: string;
}

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const systemLinks: SystemLinkItem[] = [
  {
    key: "grafana",
    label: "Grafana",
    description: "Bảng quan sát dành cho demo runtime và phần trình bày luận văn.",
    url: process.env.NEXT_PUBLIC_GRAFANA_URL || "http://localhost:3000",
  },
  {
    key: "zipkin",
    label: "Zipkin",
    description: "Theo dõi các bước nhảy giữa service trong luồng order và reservation.",
    url: process.env.NEXT_PUBLIC_ZIPKIN_URL || "http://localhost:9411",
  },
  {
    key: "prometheus",
    label: "Prometheus",
    description: "Kiểm tra các scrape target và metric series thô.",
    url: process.env.NEXT_PUBLIC_PROMETHEUS_URL || "http://localhost:9090",
  },
  {
    key: "phpmyadmin",
    label: "phpMyAdmin",
    description: "Mở MySQL nhanh để kiểm tra dữ liệu demo và các bảng outbox.",
    url: process.env.NEXT_PUBLIC_PHPMYADMIN_URL || "http://localhost:8888",
  },
  {
    key: "gatewayHealth",
    label: "Sức khỏe Gateway",
    description: "Kiểm tra nhanh endpoint health công khai của gateway.",
    url: process.env.NEXT_PUBLIC_GATEWAY_HEALTH_URL || `${apiBase}/actuator/health`,
  },
];

export function getSystemLinkUrl(key: SystemLinkItem["key"]): string {
  return systemLinks.find((item) => item.key === key)?.url || "#";
}
