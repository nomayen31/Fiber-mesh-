import { cn, statusMeta, type OrderStatusKey } from "@/lib/utils";

export function StatusBadge({ status }: { status: OrderStatusKey }) {
  const meta = statusMeta[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold",
        meta.badge,
      )}
    >
      {meta.label}
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "brand",
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "brand" | "emerald" | "amber" | "violet" | "slate";
}) {
  const tones = {
    brand: "bg-brand-50 text-brand-600 ring-brand-100",
    emerald: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    amber: "bg-amber-50 text-amber-600 ring-amber-100",
    violet: "bg-violet-50 text-violet-600 ring-violet-100",
    slate: "bg-slate-100 text-slate-600 ring-slate-200",
  } as const;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        {Icon ? (
          <span
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg ring-1",
              tones[tone],
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
        {value}
      </p>
      {hint ? <p className="mt-1 text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  );
}
