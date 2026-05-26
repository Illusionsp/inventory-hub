import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  TrendingUp,
  FileText,
  Receipt,
  CreditCard,
  Banknote,
  CalendarDays,
  BarChart2,
  ExternalLink,
  Minus,
  Building2,
  Filter,
  Printer,
} from "lucide-react";

const fmt = (n: number) =>
  `ETB ${n.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

const fmtShort = (n: number | undefined | null) =>
  (n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

const STATUS_COLORS: Record<string, string> = {
  paid: "default",
  credit: "secondary",
  partially_paid: "outline",
  overdue: "destructive",
};

const STATUS_LABELS: Record<string, string> = {
  paid: "Paid",
  credit: "Credit",
  partially_paid: "Partial",
  overdue: "Overdue",
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  cheque: "Cheque",
};

type SalesReportData = {
  from: string;
  to: string;
  groupBy: string;
  summary: {
    totalInvoices: number;
    totalRevenue: number;
    subtotalSum: number;
    cashRevenue: number;
    creditRevenue: number;
    vatCollected: number;
    withholdingTotal: number;
    discountTotal: number;
  };
  series: {
    period: string;
    invoiceCount: number;
    revenue: number;
    subtotal: number;
    vatAmount: number;
    withholdingAmount: number;
    cashRevenue: number;
    creditRevenue: number;
  }[];
  invoices: {
    id: number;
    invoiceNumber: string;
    saleDate: string;
    customerName: string | null;
    fsNumber: string | null;
    paymentType: string;
    paymentMethod: string | null;
    bankName: string | null;
    status: string;
    vatApplicable: boolean;
    subtotal: number;
    vatAmount: number;
    withholdingAmount: number;
    discountAmount: number;
    totalAmount: number;
    paidAmount: number;
    balanceDue: number;
  }[];
};

type FilterState = {
  from: string;
  to: string;
  groupBy: "daily" | "monthly";
  paymentType: string;
  paymentMethod: string;
  status: string;
};

const PM_LABELS: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  cheque: "Cheque",
};

const STS_LABELS: Record<string, string> = {
  paid: "Paid",
  credit: "Credit",
  partially_paid: "Partially Paid",
  overdue: "Overdue",
};

function generatePrintHtml(data: SalesReportData, applied: FilterState): string {
  const now = new Date().toLocaleString("en-US");

  const filterLine = [
    applied.paymentType && `Payment Type: ${applied.paymentType}`,
    applied.paymentMethod && `Method: ${PM_LABELS[applied.paymentMethod] ?? applied.paymentMethod}`,
    applied.status && `Status: ${STS_LABELS[applied.status] ?? applied.status}`,
  ].filter(Boolean).join(" | ");


  const invoiceRows = data.invoices.map(inv => {
    const n = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2 });
    return `
      <tr>
        <td class="mono">${inv.invoiceNumber}</td>
        <td class="mono dim">${inv.fsNumber ?? "—"}</td>
        <td>${inv.saleDate}</td>
        <td>${inv.customerName ?? "—"}</td>
        <td class="cap">${inv.paymentType}</td>
        <td>${inv.paymentMethod ? (PM_LABELS[inv.paymentMethod] ?? inv.paymentMethod) : "—"}</td>
        <td>${inv.bankName ?? "—"}</td>
        <td class="cap">${STS_LABELS[inv.status] ?? inv.status}</td>
        <td class="num">${n(inv.subtotal)}</td>
        <td class="num${inv.vatAmount > 0 ? " amber" : ""}">${inv.vatAmount > 0 ? n(inv.vatAmount) : "—"}</td>
        <td class="num${inv.withholdingAmount > 0 ? " red" : ""}">${inv.withholdingAmount > 0 ? n(inv.withholdingAmount) : "—"}</td>
        <td class="num bold">${n(inv.totalAmount)}</td>
        <td class="num${inv.balanceDue > 0 ? " red" : ""}">${inv.balanceDue > 0 ? n(inv.balanceDue) : "—"}</td>
      </tr>`;
  }).join("");


  const n = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2 });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Sales Report — ${data.from} to ${data.to}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: "Segoe UI", Arial, sans-serif; font-size: 11px; color: #111; background: #fff; padding: 24px 28px; }
  h1 { font-size: 20px; font-weight: 700; margin-bottom: 2px; }
  .sub { color: #666; font-size: 12px; margin-bottom: 16px; }
  .meta { display: flex; gap: 24px; font-size: 11px; color: #555; margin-bottom: 20px; border-top: 2px solid #111; padding-top: 10px; }
  .meta span b { color: #111; }
  h2 { font-size: 13px; font-weight: 700; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
  th { background: #f3f4f6; text-align: left; padding: 6px 8px; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: #555; white-space: nowrap; border-bottom: 2px solid #ddd; }
  td { padding: 5px 8px; border-bottom: 1px solid #eee; white-space: nowrap; vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  .num { text-align: right; font-family: monospace; }
  .bold { font-weight: 700; }
  .dim { color: #888; }
  .cap { text-transform: capitalize; }
  .mono { font-family: monospace; }
  .amber { color: #b45309; }
  .red { color: #dc2626; }
  .teal { color: #0f766e; }
  .purple { color: #7c3aed; }
  .total-row td { background: #f9fafb; font-weight: 700; border-top: 2px solid #ccc; }
  .footer { margin-top: 16px; font-size: 10px; color: #aaa; border-top: 1px solid #eee; padding-top: 8px; }
  @media print {
    body { padding: 12px 14px; }
    @page { margin: 1.5cm; size: A4 landscape; }
    .no-print { display: none; }
  }
</style>
</head>
<body>
<button class="no-print" onclick="window.print()" style="margin-bottom:16px;padding:7px 18px;background:#111;color:#fff;border:none;border-radius:4px;font-size:12px;cursor:pointer;">🖨 Print / Save as PDF</button>

<h1>Sales Report</h1>
<p class="sub">Multi-Store Inventory Pro</p>
<div class="meta">
  <span><b>Period:</b> ${data.from} → ${data.to}</span>
  ${filterLine ? `<span><b>Filters:</b> ${filterLine}</span>` : ""}
  <span style="margin-left:auto;"><b>Generated:</b> ${now}</span>
</div>

<h2>Invoice Details (${data.invoices.length} invoice${data.invoices.length !== 1 ? "s" : ""})</h2>
<table>
  <thead>
    <tr>
      <th>Invoice #</th><th>FS #</th><th>Date</th><th>Buyer</th>
      <th>Pay Type</th><th>Method</th><th>Bank</th><th>Status</th>
      <th class="num">Subtotal</th><th class="num">VAT</th><th class="num">WHT</th>
      <th class="num">Total</th><th class="num">Balance</th>
    </tr>
  </thead>
  <tbody>${invoiceRows}</tbody>
</table>


<div class="footer">Generated by Multi-Store Inventory Pro &bull; ${now}</div>
</body>
</html>`;
}

function getDefaultDates() {
  const today = new Date();
  const from = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  const to = today.toISOString().split("T")[0];
  return { from, to };
}

function buildParams(f: FilterState) {
  const p = new URLSearchParams({ from: f.from, to: f.to, groupBy: f.groupBy });
  if (f.paymentType) p.set("paymentType", f.paymentType);
  if (f.paymentMethod) p.set("paymentMethod", f.paymentMethod);
  if (f.status) p.set("status", f.status);
  return p.toString();
}

export default function SalesReport() {
  const [, setLocation] = useLocation();
  const defaults = getDefaultDates();

  const emptyFilters: FilterState = {
    from: defaults.from,
    to: defaults.to,
    groupBy: "daily",
    paymentType: "",
    paymentMethod: "",
    status: "",
  };

  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [applied, setApplied] = useState<FilterState>(emptyFilters);

  const set = (key: keyof FilterState, val: string) =>
    setFilters(prev => ({ ...prev, [key]: val }));

  const { data, isLoading, isFetching } = useQuery<SalesReportData>({
    queryKey: ["salesReport", buildParams(applied)],
    queryFn: async () => {
      const res = await fetch(`/api/reports/sales?${buildParams(applied)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch sales report");
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
  const series = data?.series ?? [];
  const invoices = data?.invoices ?? [];

  const hasActiveFilters = applied.paymentType || applied.paymentMethod || applied.status;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-popover border rounded-lg shadow-lg p-3 text-sm min-w-[180px]">
        <p className="font-semibold mb-2">{label}</p>
        {payload.map((p: any) => (
          <div key={p.name} className="flex justify-between gap-4">
            <span style={{ color: p.color }}>{p.name}</span>
            <span className="font-mono font-medium">{fmt(p.value)}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sales Report</h1>
          <p className="text-muted-foreground mt-1">Revenue, VAT, withholding and payment analysis</p>
        </div>
        <Button
          type="button"
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
              <Input type="date" value={filters.from} onChange={(e) => set("from", e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">To</p>
              <Input type="date" value={filters.to} onChange={(e) => set("to", e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Group By</p>
              <div className="flex rounded-md border overflow-hidden text-sm">
                {(["daily", "monthly"] as const).map((g) => (
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
              {(["today", "week", "month", "year"] as const).map((p) => (
                <Button key={p} type="button" variant="outline" size="sm" onClick={() => setPreset(p)} className="text-xs">
                  {p === "week" ? "Last 7 Days" : p === "month" ? "This Month" : p === "year" ? "This Year" : "Today"}
                </Button>
              ))}
            </div>
          </div>

          {/* Row 2: detail filters */}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Payment Type</p>
              <Select value={filters.paymentType || "all"} onValueChange={(v) => set("paymentType", v === "all" ? "" : v)}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="credit">Credit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Payment Method</p>
              <Select value={filters.paymentMethod || "all"} onValueChange={(v) => set("paymentMethod", v === "all" ? "" : v)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Status</p>
              <Select value={filters.status || "all"} onValueChange={(v) => set("status", v === "all" ? "" : v)}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="credit">Credit</SelectItem>
                  <SelectItem value="partially_paid">Partially Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Revenue", value: fmt(summary?.totalRevenue ?? 0), icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/20", border: "border-emerald-200/60" },
            { label: "Invoices Issued", value: String(summary?.totalInvoices ?? 0), icon: FileText, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/20", border: "border-blue-200/60" },
            { label: "VAT Collected", value: fmt(summary?.vatCollected ?? 0), icon: Receipt, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/20", border: "border-amber-200/60" },
            { label: "Withholding (WHT)", value: fmt(summary?.withholdingTotal ?? 0), icon: Minus, color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/20", border: "border-red-200/60" },
            { label: "Cash Revenue", value: fmt(summary?.cashRevenue ?? 0), icon: Banknote, color: "text-teal-600", bg: "bg-teal-50 dark:bg-teal-950/20", border: "border-teal-200/60" },
            { label: "Credit Revenue", value: fmt(summary?.creditRevenue ?? 0), icon: CreditCard, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950/20", border: "border-purple-200/60" },
            { label: "Total Subtotal", value: fmt(summary?.subtotalSum ?? 0), icon: BarChart2, color: "text-slate-600", bg: "bg-slate-50 dark:bg-slate-950/20", border: "border-slate-200/60" },
            { label: "Total Discounts", value: fmt(summary?.discountTotal ?? 0), icon: Building2, color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-950/20", border: "border-orange-200/60" },
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

      {/* ── Chart ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-primary" />
            Revenue by {applied.groupBy === "monthly" ? "Month" : "Day"}
            {hasActiveFilters && <span className="text-xs font-normal text-muted-foreground ml-1">(filtered)</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : series.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
              No sales data for this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={series} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={48} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="cashRevenue" name="Cash" fill="hsl(160 60% 45%)" radius={[4, 4, 0, 0]} stackId="a" />
                <Bar dataKey="creditRevenue" name="Credit" fill="hsl(262 60% 58%)" radius={[4, 4, 0, 0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ── Invoice Detail Table ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            Invoice Details
            {data && (
              <span className="text-muted-foreground font-normal text-sm ml-1">
                ({invoices.length} invoice{invoices.length !== 1 ? "s" : ""})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : invoices.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground text-sm">
              No invoices found for the selected filters
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 text-xs">
                      <TableHead className="whitespace-nowrap">Invoice #</TableHead>
                      <TableHead className="whitespace-nowrap">FS #</TableHead>
                      <TableHead className="whitespace-nowrap">Date</TableHead>
                      <TableHead className="whitespace-nowrap">Buyer</TableHead>
                      <TableHead className="whitespace-nowrap">Pay Type</TableHead>
                      <TableHead className="whitespace-nowrap">Method</TableHead>
                      <TableHead className="whitespace-nowrap">Bank</TableHead>
                      <TableHead className="whitespace-nowrap">Status</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Subtotal</TableHead>
                      <TableHead className="text-right whitespace-nowrap">VAT</TableHead>
                      <TableHead className="text-right whitespace-nowrap">WHT</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Total</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Balance</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((inv) => (
                      <TableRow key={inv.id} className="hover:bg-muted/30 text-xs">
                        <TableCell className="font-mono font-semibold whitespace-nowrap">{inv.invoiceNumber}</TableCell>
                        <TableCell className="font-mono text-muted-foreground whitespace-nowrap">
                          {inv.fsNumber ?? <span className="text-muted-foreground/50">—</span>}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{inv.saleDate}</TableCell>
                        <TableCell className="whitespace-nowrap max-w-[140px] truncate" title={inv.customerName ?? undefined}>
                          {inv.customerName ?? "—"}
                        </TableCell>
                        <TableCell>
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${inv.paymentType === "cash" ? "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400" : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"}`}>
                            {inv.paymentType}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {inv.paymentMethod ? PAYMENT_METHOD_LABELS[inv.paymentMethod] ?? inv.paymentMethod : "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground max-w-[100px] truncate" title={inv.bankName ?? undefined}>
                          {inv.bankName ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={(STATUS_COLORS[inv.status] as any) ?? "secondary"} className="text-[10px] px-1.5 py-0 whitespace-nowrap">
                            {STATUS_LABELS[inv.status] ?? inv.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono whitespace-nowrap">{fmtShort(inv.subtotal)}</TableCell>
                        <TableCell className="text-right font-mono whitespace-nowrap">
                          {inv.vatAmount > 0 ? (
                            <span className="text-amber-600">{fmtShort(inv.vatAmount)}</span>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono whitespace-nowrap">
                          {inv.withholdingAmount > 0 ? (
                            <span className="text-red-600">{fmtShort(inv.withholdingAmount)}</span>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold whitespace-nowrap">{fmtShort(inv.totalAmount)}</TableCell>
                        <TableCell className="text-right font-mono whitespace-nowrap">
                          {inv.balanceDue > 0 ? (
                            <span className="text-destructive font-semibold">{fmtShort(inv.balanceDue)}</span>
                          ) : <span className="text-muted-foreground/50">—</span>}
                        </TableCell>
                        <TableCell>
                          <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setLocation(`/sales/${inv.id}`)}>
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* ── Period Breakdown ── */}
              {series.length > 0 && (
                <>
                  <Separator />
                  <div className="p-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      Period Breakdown
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 font-medium text-muted-foreground">Period</th>
                            <th className="text-right py-2 font-medium text-muted-foreground">Inv.</th>
                            <th className="text-right py-2 font-medium text-muted-foreground">Subtotal</th>
                            <th className="text-right py-2 font-medium text-muted-foreground">Cash</th>
                            <th className="text-right py-2 font-medium text-muted-foreground">Credit</th>
                            <th className="text-right py-2 font-medium text-muted-foreground">VAT</th>
                            <th className="text-right py-2 font-medium text-muted-foreground">WHT</th>
                            <th className="text-right py-2 font-medium text-muted-foreground">Revenue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {series.map((row) => (
                            <tr key={row.period} className="border-b border-muted/40 hover:bg-muted/20">
                              <td className="py-1.5 font-medium">{row.period}</td>
                              <td className="py-1.5 text-right">{row.invoiceCount}</td>
                              <td className="py-1.5 text-right font-mono text-muted-foreground">{fmtShort(row.subtotal)}</td>
                              <td className="py-1.5 text-right font-mono text-teal-600">{fmtShort(row.cashRevenue)}</td>
                              <td className="py-1.5 text-right font-mono text-purple-600">{fmtShort(row.creditRevenue)}</td>
                              <td className="py-1.5 text-right font-mono text-amber-600">{fmtShort(row.vatAmount)}</td>
                              <td className="py-1.5 text-right font-mono text-red-500">{row.withholdingAmount > 0 ? fmtShort(row.withholdingAmount) : "—"}</td>
                              <td className="py-1.5 text-right font-mono font-semibold">{fmtShort(row.revenue)}</td>
                            </tr>
                          ))}
                          <tr className="bg-muted/50 font-bold border-t-2">
                            <td className="py-2">Total</td>
                            <td className="py-2 text-right">{summary?.totalInvoices}</td>
                            <td className="py-2 text-right font-mono text-muted-foreground">{fmtShort(summary?.subtotalSum ?? 0)}</td>
                            <td className="py-2 text-right font-mono text-teal-600">{fmtShort(summary?.cashRevenue ?? 0)}</td>
                            <td className="py-2 text-right font-mono text-purple-600">{fmtShort(summary?.creditRevenue ?? 0)}</td>
                            <td className="py-2 text-right font-mono text-amber-600">{fmtShort(summary?.vatCollected ?? 0)}</td>
                            <td className="py-2 text-right font-mono text-red-500">{(summary?.withholdingTotal ?? 0) > 0 ? fmtShort(summary!.withholdingTotal) : "—"}</td>
                            <td className="py-2 text-right font-mono">{fmtShort(summary?.totalRevenue ?? 0)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
