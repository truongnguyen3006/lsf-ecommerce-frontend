"use client";

import { AutoComplete, Button, Select, Typography } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import type { FrameworkSectionConfig, FrameworkSectionKey } from "./frameworkDemoConfig";

const { Title } = Typography;

interface DemoConsoleHeaderProps {
  activeSection: FrameworkSectionKey;
  sections: FrameworkSectionConfig[];
  trackedOrderNumber: string;
  orderOptions: Array<{ value: string; label: string }>;
  trackedSku: string;
  skuOptions: Array<{ value: string; label: string }>;
  lockTrackedSku: boolean;
  onSectionChange: (key: FrameworkSectionKey) => void;
  onTrackedOrderChange: (value?: string) => void;
  onTrackedSkuChange: (value?: string) => void;
  onRefreshAll: () => void;
}

export default function DemoConsoleHeader({
  activeSection,
  sections,
  trackedOrderNumber,
  orderOptions,
  trackedSku,
  skuOptions,
  lockTrackedSku,
  onSectionChange,
  onTrackedOrderChange,
  onTrackedSkuChange,
  onRefreshAll,
}: DemoConsoleHeaderProps) {
  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-[var(--color-border)] bg-white px-5 py-5 shadow-[var(--shadow-soft)] md:px-6">
        <div className="grid gap-4 xl:grid-cols-[0.72fr_1.48fr] xl:items-start">
          <div className="max-w-xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-muted)]">
              Framework Console
            </div>
            <Title level={3} className="!mb-2 !mt-2 !text-[var(--color-primary)]">
              Bảng điều khiển framework
            </Title>
          </div>

          <div className="grid gap-3 rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-4 lg:grid-cols-[1.75fr_1.15fr_auto] lg:items-end">
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
                Order đang theo dõi
              </div>
              <AutoComplete
                value={trackedOrderNumber}
                options={orderOptions}
                onChange={onTrackedOrderChange}
                onSelect={onTrackedOrderChange}
                placeholder="Nhập hoặc chọn orderNumber"
                allowClear
                popupMatchSelectWidth={640}
                className="w-full"
                filterOption={(inputValue, option) =>
                  String(option?.value || "")
                    .toUpperCase()
                    .includes(inputValue.toUpperCase())
                }
              />
            </div>

            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
                SKU đang theo dõi
              </div>
              {lockTrackedSku ? (
                <Select
                  value={trackedSku || undefined}
                  options={skuOptions}
                  onChange={onTrackedSkuChange}
                  onClear={() => onTrackedSkuChange(undefined)}
                  placeholder="Chọn SKU trong đơn"
                  allowClear
                  showSearch
                  popupMatchSelectWidth={420}
                  className="w-full"
                  filterOption={(inputValue, option) =>
                    String(option?.value || "")
                      .toUpperCase()
                      .includes(inputValue.toUpperCase()) ||
                    String(option?.label || "")
                      .toUpperCase()
                      .includes(inputValue.toUpperCase())
                  }
                />
              ) : (
                <AutoComplete
                  value={trackedSku}
                  options={skuOptions}
                  onChange={onTrackedSkuChange}
                  onSelect={onTrackedSkuChange}
                  placeholder="Nhập hoặc chọn SKU"
                  allowClear
                  popupMatchSelectWidth={420}
                  className="w-full"
                  filterOption={(inputValue, option) =>
                    String(option?.value || "")
                      .toUpperCase()
                      .includes(inputValue.toUpperCase())
                  }
                />
              )}
            </div>

            <Button
              icon={<ReloadOutlined />}
              onClick={onRefreshAll}
              className="!h-11 !rounded-full !border-[var(--color-border-strong)] !px-5 !font-medium lg:mt-0"
            >
              Làm mới
            </Button>
          </div>
        </div>
      </section>

      <div className="sticky top-4 z-20 rounded-[22px] border border-[var(--color-border)] bg-white/92 p-2 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="grid gap-2 lg:grid-cols-5">
          {sections.map((section) => {
            const isActive = section.key === activeSection;
            return (
              <button
                key={section.key}
                type="button"
                onClick={() => onSectionChange(section.key)}
                className={`rounded-[18px] border px-4 py-3 text-left transition ${
                  isActive
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white shadow-[0_12px_28px_rgba(17,17,17,0.14)]"
                    : "border-transparent bg-[var(--color-surface-muted)] text-[var(--color-primary)] hover:border-[var(--color-border-strong)] hover:bg-white"
                }`}
              >
                <div
                  className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${
                    isActive ? "text-white/68" : "text-[var(--color-muted)]"
                  }`}
                >
                  {section.eyebrow}
                </div>
                <div className="mt-1 text-sm font-semibold">{section.label}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
