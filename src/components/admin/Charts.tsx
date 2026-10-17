"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  formatBdt,
  formatNumber,
  statusMeta,
  type OrderStatusKey,
} from "@/lib/utils";
import type { StatsSeriesPoint } from "@/lib/types";

const axisStyle = { fontSize: 11, fill: "#64748b" };

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  boxShadow: "0 8px 24px -8px rgb(16 24 40 / 0.18)",
  fontSize: 12,
  padding: "8px 12px",
};

export function RevenueTrendChart({ data }: { data: StatsSeriesPoint[] }) {
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2574eb" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#2574eb" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
          <XAxis
            dataKey="label"
            tick={axisStyle}
            tickLine={false}
            axisLine={{ stroke: "#e2e8f0" }}
            minTickGap={16}
          />
          <YAxis
            tick={axisStyle}
            tickLine={false}
            axisLine={false}
            width={64}
            tickFormatter={(value: number) => formatBdt(value)}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value: number) => [formatBdt(value), "বিক্রয়"]}
            labelFormatter={(label) => `তারিখ: ${label}`}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#2574eb"
            strokeWidth={2.5}
            fill="url(#revenueFill)"
            name="বিক্রয়"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function OrdersTrendChart({ data }: { data: StatsSeriesPoint[] }) {
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
          <XAxis
            dataKey="label"
            tick={axisStyle}
            tickLine={false}
            axisLine={{ stroke: "#e2e8f0" }}
            minTickGap={16}
          />
          <YAxis
            tick={axisStyle}
            tickLine={false}
            axisLine={false}
            width={40}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value: number, name) => [
              name === "orders" ? formatNumber(value) : formatNumber(value),
              name === "orders" ? "অর্ডার" : "রোল",
            ]}
            labelFormatter={(label) => `তারিখ: ${label}`}
          />
          <Legend
            formatter={(value) => (value === "orders" ? "অর্ডার সংখ্যা" : "রোল")}
            wrapperStyle={{ fontSize: 12 }}
          />
          <Bar dataKey="orders" fill="#2574eb" radius={[6, 6, 0, 0]} name="orders" />
          <Bar dataKey="rolls" fill="#fdb022" radius={[6, 6, 0, 0]} name="rolls" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StatusDonut({
  data,
}: {
  data: { status: string; count: number }[];
}) {
  const chartData = data
    .filter((item) => item.count > 0)
    .map((item) => ({
      name: statusMeta[item.status as OrderStatusKey]?.label ?? item.status,
      value: item.count,
      color: statusMeta[item.status as OrderStatusKey]?.dot ?? "#94a3b8",
    }));

  if (chartData.length === 0) {
    return (
      <p className="flex h-[240px] items-center justify-center text-sm text-slate-500">
        এখনো কোনো অর্ডার আসেনি।
      </p>
    );
  }

  return (
    <div className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={3}
            stroke="none"
          >
            {chartData.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value: number) => [`${value} টি`, "অর্ডার"]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
