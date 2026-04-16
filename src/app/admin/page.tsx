"use client";

import Link from "next/link";
import { Button, Card, Tag } from "antd";
import { ArrowRightOutlined, DeploymentUnitOutlined } from "@ant-design/icons";

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      <Card className="app-admin-card border-0">
        <div className="max-w-3xl">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">
            Admin
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-primary)]">
            Demo Console
          </h1>
          <div className="mt-5 flex flex-wrap gap-2">
            <Tag color="blue">Workflow</Tag>
            <Tag color="gold">Saga</Tag>
            <Tag color="cyan">Outbox</Tag>
            <Tag color="green">Runtime</Tag>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/admin/framework">
              <Button
                type="primary"
                icon={<DeploymentUnitOutlined />}
                className="!bg-[var(--color-primary)]"
              >
                Mở Demo Console
              </Button>
            </Link>
            <Link href="/admin/orders">
              <Button icon={<ArrowRightOutlined />}>Mở danh sách đơn hàng</Button>
            </Link>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
          <div className="space-y-2 text-sm leading-7 text-[var(--color-secondary)]">
            <div>Nếu cần benchmark hoặc load test, nên trình bày ở tài liệu, Grafana hoặc JMeter riêng.</div>
          </div>
      </div>
    </div>
  );
}
