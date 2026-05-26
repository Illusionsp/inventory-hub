import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  ArrowUpRight,
  ExternalLink,
} from "lucide-react";

const fmt = (n: number) =>
  `ETB ${n.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

const STATUS_COLORS: Record<string, string> = {
  paid: "default",
  credit: "secondary",
  partially_paid: "outline",
  overdue: "destructive",
};

type SalesReportData = {
  from: string;
  to: string;
  groupBy: string;
  summary: {
    totalInvoices: number;
    totalRevenue: number;
    cashRevenue: number;
    creditRevenue: number;
    vatCollected: number;
  };
  series: {
    period: string;
    invoiceCount: number;
    revenue: number;
    vatAmount: number;
    cashRevenue: number;
    creditRevenue: number;
  }[];
  invoices: {
    id: number;
    invoiceNumber: string;
    saleDate: string;
    customerName: string | null;
    paymentType: string;
    status: string;
    totalAmount: number;
    vatAmount: number;
    paidAmount: number;
    balanceDue: number;
  }[];
};

function getDefaultDates() {
  const today = new Date();
  const from = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  const to = today.toISOString().split("T")[0];
  return { from, to };
}

export default function SalesReport() {
  const [, setLocation] = useLocation();
  const defaults = getDefaultDates();
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [groupBy, setGroupBy] = useState<"daily" | "monthly">("daily");
  const [applied, setApplied] = useState({ from: defaults.from, to: defaults.to, groupBy: "daily" as "daily" | "monthly" });

  const { data, isLoading, isFetching } = useQuery<SalesReportData>({
    queryKey: ["salesReport", applied.from, applied.to, applied.groupBy],
    queryFn: async () => {
      const params = new URLSearchParams({ from: applied.from, to: applied.to, groupBy: applied.groupBy });
      const res = await fetch(`/api/reports/sales?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch sales report");
      return res.json();
    },
  });

  const handleApply = () => setApplied({ from, to, groupBy });

  const setPreset = (preset: "today" | "week" | "month" | "year") => {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const todayStr = fmt(today);
    if (preset === "today") {
      setFrom(todayStr); setTo(todayStr); setGroupBy("daily");
    } else if (preset === "week") {
      const start = new Date(today); start.setDate(today.getDate() - 6);
      setFrom(fmt(start)); setTo(todayStr); setGroupBy("daily");
    } else if (preset === "month") {
      setFrom(`${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`);
      setTo(todayStr); setGroupBy("daily");
    } else if (preset === "year") {
      setFrom(`${today.getFullYear()}-01-01`); setTo(todayStr); setGroupBy("monthly");
    }
  };

  const summary = data?.summary;
  const series = data?.series ?? [];
  const invoices = data?.invoices ?? [];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-popover border rounded-lg shadow-lg p-3 text-sm">
        <p className="font-semibold mb-2">{label}</p>
        {payload.map((p: any) => (
          <div key={p.name} className="flex gap-3 justify-between">
            <span style={{ color: p.color }}>{p.name}</span>
            <span className="font-mono font-medium">{fmt(p.value)}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sales Report</h1>
          <p className="text-muted-foreground mt-1">Revenue analysis by date range and period</p>
        </div>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">From</p>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">To</p>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Group By</p>
              <div className="flex rounded-md border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setGroupBy("daily")}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${groupBy === "daily" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
                >
                  Daily
                </button>
                <button
                  type="button"
                  onClick={() => setGroupBy("monthly")}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${groupBy === "monthly" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
                >
                  Monthly
                </button>
              </div>
            </div>
            <Button type="button" onClick={handleApply} disabled={isFetching}>
              <BarChart2 className="h-4 w-4 mr-2" />
              {isFetching ? "Loading..." : "Apply"}
            </Button>
            <div className="flex gap-1.5 ml-auto flex-wrap">
              {(["today", "week", "month", "year"] as const).map((p) => (
                <Button
                  key={p}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => { setPreset(p); setTimeout(handleApply, 0); }}
                  className="text-xs capitalize"
                >
                  {p === "week" ? "Last 7 days" : p === "month" ? "This Month" : p === "year" ? "This Year" : "Today"}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            {
              label: "Total Revenue",
              value: fmt(summary?.totalRevenue ?? 0),
              icon: TrendingUp,
              color: "text-emerald-600",
              bg: "bg-emerald-50 dark:bg-emerald-950/20",
              border: "border-emerald-200/60",
            },
            {
              label: "Invoices Issued",
              value: summary?.totalInvoices ?? 0,
              icon: FileText,
              color: "text-blue-600",
              bg: "bg-blue-50 dark:bg-blue-950/20",
              border: "border-blue-200/60",
            },
            {
              label: "VAT Collected",
              value: fmt(summary?.vatCollected ?? 0),
              icon: Receipt,
              color: "text-amber-600",
              bg: "bg-amber-50 dark:bg-amber-950/20",
              border: "border-amber-200/60",
            },
            {
              label: "Cash Revenue",
              value: fmt(summary?.cashRevenue ?? 0),
              icon: Banknote,
              color: "text-teal-600",
              bg: "bg-teal-50 dark:bg-teal-950/20",
              border: "border-teal-200/60",
            },
            {
              label: "Credit Revenue",
              value: fmt(summary?.creditRevenue ?? 0),
              icon: CreditCard,
              color: "text-purple-600",
              bg: "bg-purple-50 dark:bg-purple-950/20",
              border: "border-purple-200/60",
            },
          ].map(({ label, value, icon: Icon, color, bg, border }) => (
            <Card key={label} className={`${border}`}>
              <CardContent className="pt-5">
                <div className={`h-9 w-9 rounded-xl ${bg} flex items-center justify-center mb-3`}>
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
                <p className="text-xs text-muted-foreground font-medium">{label}</p>
                <p className={`text-lg font-bold mt-0.5 ${typeof value === "number" ? "" : "text-sm"} font-mono`}>{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-primary" />
            Revenue by {applied.groupBy === "monthly" ? "Month" : "Day"}
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
                <XAxis
                  dataKey="period"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="cashRevenue" name="Cash" fill="hsl(160 60% 45%)" radius={[4, 4, 0, 0]} stackId="a" />
                <Bar dataKey="creditRevenue" name="Credit" fill="hsl(262 60% 58%)" radius={[4, 4, 0, 0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              Individual Invoices
              {data && (
                <span className="text-muted-foreground font-normal text-sm ml-1">
                  ({invoices.length} total)
                </span>
              )}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : invoices.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No invoices found for the selected period
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">VAT</TableHead>
                    <TableHead className="text-right">Balance Due</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => (
                    <TableRow key={inv.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-sm font-medium">{inv.invoiceNumber}</TableCell>
                      <TableCell className="text-sm">{inv.saleDate}</TableCell>
                      <TableCell className="text-sm">{inv.customerName ?? "—"}</TableCell>
                      <TableCell>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${inv.paymentType === "cash" ? "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400" : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"}`}>
                          {inv.paymentType === "cash" ? "Cash" : "Credit"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={(STATUS_COLORS[inv.status] as any) ?? "secondary"} className="text-xs capitalize">
                          {inv.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold">
                        {fmt(inv.totalAmount)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-muted-foreground">
                        {inv.vatAmount > 0 ? fmt(inv.vatAmount) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {inv.balanceDue > 0 ? (
                          <span className="text-destructive font-semibold">{fmt(inv.balanceDue)}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setLocation(`/sales/${inv.id}`)}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {/* Period Breakdown Table */}
              {series.length > 1 && (
                <>
                  <Separator />
                  <div className="p-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      Period Breakdown
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 font-medium text-muted-foreground">Period</th>
                            <th className="text-right py-2 font-medium text-muted-foreground">Invoices</th>
                            <th className="text-right py-2 font-medium text-muted-foreground">Cash</th>
                            <th className="text-right py-2 font-medium text-muted-foreground">Credit</th>
                            <th className="text-right py-2 font-medium text-muted-foreground">VAT</th>
                            <th className="text-right py-2 font-medium text-muted-foreground">Revenue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {series.map((row) => (
                            <tr key={row.period} className="border-b border-muted/50 hover:bg-muted/20">
                              <td className="py-2 font-medium">{row.period}</td>
                              <td className="py-2 text-right">{row.invoiceCount}</td>
                              <td className="py-2 text-right font-mono text-teal-600">{fmt(row.cashRevenue)}</td>
                              <td className="py-2 text-right font-mono text-purple-600">{fmt(row.creditRevenue)}</td>
                              <td className="py-2 text-right font-mono text-amber-600">{fmt(row.vatAmount)}</td>
                              <td className="py-2 text-right font-mono font-semibold">{fmt(row.revenue)}</td>
                            </tr>
                          ))}
                          <tr className="bg-muted/40 font-bold">
                            <td className="py-2 pl-1">Total</td>
                            <td className="py-2 text-right">{summary?.totalInvoices}</td>
                            <td className="py-2 text-right font-mono text-teal-600">{fmt(summary?.cashRevenue ?? 0)}</td>
                            <td className="py-2 text-right font-mono text-purple-600">{fmt(summary?.creditRevenue ?? 0)}</td>
                            <td className="py-2 text-right font-mono text-amber-600">{fmt(summary?.vatCollected ?? 0)}</td>
                            <td className="py-2 text-right font-mono">{fmt(summary?.totalRevenue ?? 0)}</td>
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
