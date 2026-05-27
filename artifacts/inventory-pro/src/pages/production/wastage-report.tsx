import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  Cell,
} from "recharts";
import {
  AlertTriangle,
  BarChart2,
  Box,
  CalendarDays,
  Factory,
  Filter,
  Package,
  Printer,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useListStores, useListProducts } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────
type WastageReport = {
  from: string;
  to: string;
  groupBy: string;
  summary: {
    totalBatches: number;
    totalInputQty: number;
    totalOutputQty: number;
    totalWastageQty: number;
    avgWastagePercent: number;
    avgYieldPercent: number;
  };
  byBatch: {
    id: number;
    batchNumber: string;
    type: string;
    finalProductName: string | null;
    productionDate: string | null;
    completedAt: string | null;
    plannedOutputQty: number;
    actualOutputQty: number;
    wastageQty: number;
    wastagePercent: number;
    yieldPercent: number;
    outputUnit: string;
    storeFromName: string | null;
    storeToName: string | null;
    packagesProduced: number | null;
    packageSize: number | null;
    packageSizeUnit: string | null;
  }[];
  byProduct: {
    productId: number;
    productName: string;
    unit: string;
    totalInputQty: number;
    batchCount: number;
  }[];
  byDate: {
    period: string;
    batchCount: number;
    totalWastageQty: number;
    totalOutputQty: number;
    avgWastagePercent: number;
  }[];
};

type FilterState = {
  from: string;
  to: string;
  groupBy: "daily" | "monthly";
  storeId: string;
  productId: string;
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function getDefaultDates() {
  const today = new Date();
  const from = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  const to = today.toISOString().split("T")[0];
  return { from, to };
}

function buildParams(f: FilterState) {
  const p = new URLSearchParams({ from: f.from, to: f.to, groupBy: f.groupBy });
  if (f.storeId) p.set("storeId", f.storeId);
  if (f.productId) p.set("productId", f.productId);
  return p.toString();
}

const fmtQty = (n: number, unit?: string | null) => {
  const v = n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 3 });
  return unit ? `${v} ${unit}` : v;
};

const fmtPct = (n: number) => `${n.toFixed(2)}%`;

function wastageColor(pct: number): string {
  if (pct >= 20) return "text-red-600";
  if (pct >= 10) return "text-amber-600";
  return "text-emerald-600";
}

function wastageBarColor(pct: number): string {
  if (pct >= 20) return "hsl(0 72% 51%)";
  if (pct >= 10) return "hsl(38 92% 50%)";
  return "hsl(142 71% 45%)";
}

const TYPE_LABELS: Record<string, string> = {
  raw_to_semi: "Raw → Semi",
  semi_to_finished: "Semi → Finished",
};

// ── Print helper ─────────────────────────────────────────────────────────────
function generatePrintHtml(data: WastageReport, applied: FilterState): string {
  const now = new Date().toLocaleString("en-US");
  const n3 = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 3 });

  const batchRows = data.byBatch.map(b => `
    <tr>
      <td class="mono">${b.batchNumber}</td>
      <td>${b.finalProductName ?? "—"}</td>
      <td class="cap">${TYPE_LABELS[b.type] ?? b.type}</td>
      <td>${b.productionDate ?? "—"}</td>
      <td>${b.storeFromName ?? "—"} → ${b.storeToName ?? "—"}</td>
      <td class="num">${n3(b.plannedOutputQty)} ${b.outputUnit}</td>
      <td class="num teal">${n3(b.actualOutputQty)} ${b.outputUnit}</td>
      <td class="num red">${n3(b.wastageQty)} ${b.outputUnit}</td>
      <td class="num ${b.wastagePercent >= 20 ? "red" : b.wastagePercent >= 10 ? "amber" : "teal"}">${fmtPct(b.wastagePercent)}</td>
      <td class="num teal">${fmtPct(b.yieldPercent)}</td>
    </tr>`).join("");

  const productRows = data.byProduct.map(p => `
    <tr>
      <td>${p.productName}</td>
      <td class="num">${n3(p.totalInputQty)} ${p.unit}</td>
      <td class="num">${p.batchCount}</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<title>Wastage Report — ${data.from} to ${data.to}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: "Segoe UI", Arial, sans-serif; font-size: 11px; color: #111; background: #fff; padding: 24px 28px; }
  h1 { font-size: 20px; font-weight: 700; margin-bottom: 2px; }
  .sub { color: #666; font-size: 12px; margin-bottom: 16px; }
  .meta { display: flex; gap: 24px; font-size: 11px; color: #555; margin-bottom: 20px; border-top: 2px solid #111; padding-top: 10px; }
  .kpis { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; margin-bottom: 24px; }
  .kpi { border: 1px solid #ddd; border-radius: 6px; padding: 10px 12px; }
  .kpi-label { font-size: 9px; text-transform: uppercase; letter-spacing: .05em; color: #888; margin-bottom: 4px; }
  .kpi-value { font-size: 14px; font-weight: 700; font-family: monospace; }
  h2 { font-size: 13px; font-weight: 700; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 4px; margin-top: 20px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th { background: #f3f4f6; text-align: left; padding: 6px 8px; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: #555; white-space: nowrap; border-bottom: 2px solid #ddd; }
  td { padding: 5px 8px; border-bottom: 1px solid #eee; white-space: nowrap; vertical-align: middle; }
  .num { text-align: right; font-family: monospace; }
  .mono { font-family: monospace; }
  .cap { text-transform: capitalize; }
  .teal { color: #0f766e; font-weight: 600; }
  .amber { color: #b45309; font-weight: 600; }
  .red { color: #dc2626; font-weight: 600; }
  .footer { margin-top: 16px; font-size: 10px; color: #aaa; border-top: 1px solid #eee; padding-top: 8px; }
  @media print { body { padding: 12px; } @page { margin: 1.5cm; size: A4 landscape; } .no-print { display: none; } }
</style></head><body>
<button class="no-print" onclick="window.print()" style="margin-bottom:16px;padding:7px 18px;background:#111;color:#fff;border:none;border-radius:4px;font-size:12px;cursor:pointer;">🖨 Print / Save as PDF</button>
<h1>Wastage Summary Report</h1>
<p class="sub">RAFLOS Softwares</p>
<div class="meta">
  <span><b>Period:</b> ${data.from} → ${data.to}</span>
  <span style="margin-left:auto;"><b>Generated:</b> ${now}</span>
</div>
<div class="kpis">
  <div class="kpi"><div class="kpi-label">Batches</div><div class="kpi-value">${data.summary.totalBatches}</div></div>
  <div class="kpi"><div class="kpi-label">Total Input</div><div class="kpi-value">${n3(data.summary.totalInputQty)}</div></div>
  <div class="kpi"><div class="kpi-label">Total Output</div><div class="kpi-value teal">${n3(data.summary.totalOutputQty)}</div></div>
  <div class="kpi"><div class="kpi-label">Total Wastage</div><div class="kpi-value red">${n3(data.summary.totalWastageQty)}</div></div>
  <div class="kpi"><div class="kpi-label">Avg Wastage %</div><div class="kpi-value ${data.summary.avgWastagePercent >= 20 ? "red" : data.summary.avgWastagePercent >= 10 ? "amber" : "teal"}">${fmtPct(data.summary.avgWastagePercent)}</div></div>
  <div class="kpi"><div class="kpi-label">Avg Yield %</div><div class="kpi-value teal">${fmtPct(data.summary.avgYieldPercent)}</div></div>
</div>
<h2>By Batch (${data.byBatch.length} batch${data.byBatch.length !== 1 ? "es" : ""})</h2>
<table><thead><tr>
  <th>Batch #</th><th>Product</th><th>Type</th><th>Date</th><th>Stores</th>
  <th class="num">Planned</th><th class="num">Actual Output</th><th class="num">Wastage</th>
  <th class="num">Wastage %</th><th class="num">Yield %</th>
</tr></thead><tbody>${batchRows}</tbody></table>
<h2>Raw Material Input by Product</h2>
<table><thead><tr><th>Product</th><th class="num">Total Input</th><th class="num">Batches</th></tr></thead>
<tbody>${productRows}</tbody></table>
<div class="footer">Generated by RAFLOS Softwares &bull; ${now}</div>
</body></html>`;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function WastageReportPage() {
  const [, navigate] = useLocation();
  const defaults = getDefaultDates();

  const emptyFilters: FilterState = {
    from: defaults.from,
    to: defaults.to,
    groupBy: "daily",
    storeId: "",
    productId: "",
  };

  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [applied, setApplied] = useState<FilterState>(emptyFilters);

  const set = (key: keyof FilterState, val: string) =>
    setFilters(prev => ({ ...prev, [key]: val }));

  const { data: storesRes } = useListStores({});
  const { data: productsRes } = useListProducts({ limit: 200 });
  const stores = (storesRes as any)?.data ?? storesRes ?? [];
  const products = (productsRes as any)?.data ?? productsRes ?? [];

  const { data, isLoading, isFetching } = useQuery<WastageReport>({
    queryKey: ["wastageReport", buildParams(applied)],
    queryFn: async () => {
      const res = await fetch(`/api/reports/wastage?${buildParams(applied)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch wastage report");
      return res.json();
    },
  });

  const handleApply = () => setApplied({ ...filters });
  const handleReset = () => { setFilters(emptyFilters); setApplied(emptyFilters); };

  const handlePrint = () => {
    if (!data) return;
    const html = generatePrintHtml(data, applied);
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
  };

  const setPreset = (preset: "today" | "week" | "month" | "year") => {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const fmtDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const todayStr = fmtDate(today);
    let from = todayStr, to = todayStr, groupBy: "daily" | "monthly" = "daily";
    if (preset === "week") {
      const start = new Date(today); start.setDate(today.getDate() - 6);
      from = fmtDate(start);
    } else if (preset === "month") {
      from = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`;
    } else if (preset === "year") {
      from = `${today.getFullYear()}-01-01`;
      groupBy = "monthly";
    }
    const next = { ...filters, from, to, groupBy };
    setFilters(next);
    setApplied(next);
  };

  const summary = data?.summary;
  const byDate = data?.byDate ?? [];
  const byBatch = data?.byBatch ?? [];
  const byProduct = data?.byProduct ?? [];
  const hasActiveFilters = applied.storeId || applied.productId;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-popover border rounded-lg shadow-lg p-3 text-sm min-w-[200px]">
        <p className="font-semibold mb-2">{label}</p>
        {payload.map((p: any) => (
          <div key={p.name} className="flex justify-between gap-4">
            <span style={{ color: p.color }}>{p.name}</span>
            <span className="font-mono font-medium">
              {p.name === "Wastage %" ? fmtPct(p.value) : p.value.toLocaleString("en-US", { maximumFractionDigits: 3 })}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Wastage Report</h1>
          <p className="text-muted-foreground mt-1">
            Raw material input, production output, and wastage analysis by batch
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handlePrint}
          disabled={!data || isFetching}
          className="shrink-0 mt-1"
        >
          <Printer className="h-4 w-4 mr-2" />
          Print Report
        </Button>
      </div>

      {/* ── Filters ── */}
      <Card>
        <CardHeader className="pb-3 pt-4">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Filter className="h-3.5 w-3.5" /> Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          {/* Row 1: dates + groupBy + presets */}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">From</p>
              <Input type="date" value={filters.from} onChange={e => set("from", e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">To</p>
              <Input type="date" value={filters.to} onChange={e => set("to", e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Group By</p>
              <div className="flex rounded-md border overflow-hidden text-sm">
                {(["daily", "monthly"] as const).map(g => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => set("groupBy", g)}
                    className={`px-3 py-1.5 font-medium transition-colors capitalize ${filters.groupBy === g ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-1.5 ml-auto flex-wrap">
              {(["today", "week", "month", "year"] as const).map(p => (
                <Button key={p} type="button" variant="outline" size="sm" onClick={() => setPreset(p)} className="text-xs">
                  {p === "week" ? "Last 7 Days" : p === "month" ? "This Month" : p === "year" ? "This Year" : "Today"}
                </Button>
              ))}
            </div>
          </div>

          {/* Row 2: store + product filters */}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Store</p>
              <Select value={filters.storeId || "all"} onValueChange={v => set("storeId", v === "all" ? "" : v)}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Stores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stores</SelectItem>
                  {Array.isArray(stores) && stores.map((s: any) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Input Product</p>
              <Select value={filters.productId || "all"} onValueChange={v => set("productId", v === "all" ? "" : v)}>
                <SelectTrigger className="w-52">
                  <SelectValue placeholder="All Products" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  {Array.isArray(products) && products.map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 ml-auto">
              {hasActiveFilters && (
                <Button type="button" variant="ghost" size="sm" onClick={handleReset} className="text-xs">
                  Clear Filters
                </Button>
              )}
              <Button type="button" onClick={handleApply} disabled={isFetching}>
                <BarChart2 className="h-4 w-4 mr-2" />
                {isFetching ? "Loading…" : "Apply"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── KPI Cards ── */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: "Batches Completed", value: String(summary?.totalBatches ?? 0), icon: Factory, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/20", border: "border-blue-200/60" },
            { label: "Total Raw Input", value: fmtQty(summary?.totalInputQty ?? 0), icon: Package, color: "text-slate-600", bg: "bg-slate-50 dark:bg-slate-950/20", border: "border-slate-200/60" },
            { label: "Total Output", value: fmtQty(summary?.totalOutputQty ?? 0), icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/20", border: "border-emerald-200/60" },
            { label: "Total Wastage", value: fmtQty(summary?.totalWastageQty ?? 0), icon: TrendingDown, color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/20", border: "border-red-200/60" },
            {
              label: "Avg Wastage %",
              value: fmtPct(summary?.avgWastagePercent ?? 0),
              icon: AlertTriangle,
              color: (summary?.avgWastagePercent ?? 0) >= 20 ? "text-red-600" : (summary?.avgWastagePercent ?? 0) >= 10 ? "text-amber-600" : "text-emerald-600",
              bg: (summary?.avgWastagePercent ?? 0) >= 20 ? "bg-red-50 dark:bg-red-950/20" : (summary?.avgWastagePercent ?? 0) >= 10 ? "bg-amber-50 dark:bg-amber-950/20" : "bg-emerald-50 dark:bg-emerald-950/20",
              border: (summary?.avgWastagePercent ?? 0) >= 20 ? "border-red-200/60" : (summary?.avgWastagePercent ?? 0) >= 10 ? "border-amber-200/60" : "border-emerald-200/60",
            },
            { label: "Avg Yield %", value: fmtPct(summary?.avgYieldPercent ?? 0), icon: Box, color: "text-teal-600", bg: "bg-teal-50 dark:bg-teal-950/20", border: "border-teal-200/60" },
          ].map(({ label, value, icon: Icon, color, bg, border }) => (
            <Card key={label} className={border}>
              <CardContent className="pt-5">
                <div className={`h-9 w-9 rounded-xl ${bg} flex items-center justify-center mb-3`}>
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
                <p className="text-xs text-muted-foreground font-medium">{label}</p>
                <p className="text-sm font-bold mt-0.5 font-mono leading-tight">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Wastage Trend Chart ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              Wastage Quantity by {applied.groupBy === "monthly" ? "Month" : "Day"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : byDate.length === 0 ? (
              <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">
                No completed batches in this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={byDate} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="totalOutputQty" name="Output" fill="hsl(160 60% 45%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="totalWastageQty" name="Wastage" fill="hsl(0 72% 58%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Avg Wastage % by {applied.groupBy === "monthly" ? "Month" : "Day"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : byDate.length === 0 ? (
              <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">
                No completed batches in this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={byDate} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={44} tickFormatter={v => `${v}%`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="avgWastagePercent" name="Wastage %" radius={[4, 4, 0, 0]}>
                    {byDate.map((entry, i) => (
                      <Cell key={i} fill={wastageBarColor(entry.avgWastagePercent)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── By-Product Table ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            Raw Material Input by Product
            {data && <span className="text-muted-foreground font-normal text-sm ml-1">({byProduct.length} product{byProduct.length !== 1 ? "s" : ""})</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : byProduct.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground text-sm">No input data for this period</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 text-xs">
                    <TableHead>Product Name</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Total Input Qty</TableHead>
                    <TableHead className="text-right">Batches Used In</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byProduct.map(p => (
                    <TableRow key={p.productId}>
                      <TableCell className="font-medium">{p.productName}</TableCell>
                      <TableCell className="text-muted-foreground">{p.unit}</TableCell>
                      <TableCell className="text-right font-mono">{fmtQty(p.totalInputQty, p.unit)}</TableCell>
                      <TableCell className="text-right">{p.batchCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── By-Batch Table ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            Batch Detail
            {data && <span className="text-muted-foreground font-normal text-sm ml-1">({byBatch.length} batch{byBatch.length !== 1 ? "es" : ""})</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : byBatch.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground text-sm">No completed batches found for the selected filters</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 text-xs">
                    <TableHead className="whitespace-nowrap">Batch #</TableHead>
                    <TableHead className="whitespace-nowrap">Product</TableHead>
                    <TableHead className="whitespace-nowrap">Type</TableHead>
                    <TableHead className="whitespace-nowrap">Date</TableHead>
                    <TableHead className="whitespace-nowrap">Stores</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Planned</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Actual Output</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Wastage</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Wastage %</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Yield %</TableHead>
                    <TableHead className="whitespace-nowrap">Packages</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byBatch.map(b => (
                    <TableRow
                      key={b.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/production/${b.id}`)}
                    >
                      <TableCell className="font-mono text-xs">{b.batchNumber}</TableCell>
                      <TableCell className="font-medium max-w-[140px] truncate">{b.finalProductName ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] whitespace-nowrap">
                          {TYPE_LABELS[b.type] ?? b.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">{b.productionDate ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {b.storeFromName ?? "?"} → {b.storeToName ?? "?"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {fmtQty(b.plannedOutputQty, b.outputUnit)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-emerald-600 font-medium">
                        {fmtQty(b.actualOutputQty, b.outputUnit)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-red-600 font-medium">
                        {fmtQty(b.wastageQty, b.outputUnit)}
                      </TableCell>
                      <TableCell className={cn("text-right font-mono text-xs font-bold", wastageColor(b.wastagePercent))}>
                        {fmtPct(b.wastagePercent)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-emerald-600 font-medium">
                        {fmtPct(b.yieldPercent)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {b.packagesProduced != null
                          ? `${b.packagesProduced} × ${b.packageSize ?? ""}${b.packageSizeUnit ?? ""}`
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
