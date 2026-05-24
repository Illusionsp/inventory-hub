import React from "react";
import { Link } from "wouter";
import {
  useGetDashboardSummary,
  useGetDashboardSalesTrend,
  useGetDashboardAlerts,
  useGetDashboardPendingApprovals,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CircleDollarSign,
  ClipboardCheck,
  Factory,
  PackageX,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const formatETB = (val: number) =>
  `ETB ${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  isLoading,
  color,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description?: string;
  isLoading?: boolean;
  color: "amber" | "teal" | "purple" | "coral";
}) {
  const colorMap = {
    amber: {
      bg: "bg-amber-100 dark:bg-amber-900/30",
      icon: "text-amber-600 dark:text-amber-400",
      card: "border-amber-200/60 dark:border-amber-800/40",
    },
    teal: {
      bg: "bg-teal-100 dark:bg-teal-900/30",
      icon: "text-teal-600 dark:text-teal-400",
      card: "border-teal-200/60 dark:border-teal-800/40",
    },
    purple: {
      bg: "bg-purple-100 dark:bg-purple-900/30",
      icon: "text-purple-600 dark:text-purple-400",
      card: "border-purple-200/60 dark:border-purple-800/40",
    },
    coral: {
      bg: "bg-rose-100 dark:bg-rose-900/30",
      icon: "text-rose-600 dark:text-rose-400",
      card: "border-rose-200/60 dark:border-rose-800/40",
    },
  };

  const c = colorMap[color];

  return (
    <Card className={`${c.card}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground">{title}</CardTitle>
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${c.bg}`}>
          <Icon className={`h-5 w-5 ${c.icon}`} />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className="text-2xl font-bold tracking-tight">{value}</div>
        )}
        {description && (
          <p className="text-xs text-muted-foreground mt-1.5">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();
  const { data: salesTrend, isLoading: isLoadingTrend } = useGetDashboardSalesTrend({ period: "monthly" });
  const { data: alerts, isLoading: isLoadingAlerts } = useGetDashboardAlerts();
  const { data: pendingApprovals, isLoading: isLoadingApprovals } = useGetDashboardPendingApprovals();

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Overview of your manufacturing and inventory operations.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Stock Value"
          value={summary ? formatETB(summary.totalStockValue) : "ETB 0.00"}
          icon={CircleDollarSign}
          color="amber"
          isLoading={isLoadingSummary}
        />
        <StatCard
          title="Today's Sales"
          value={summary ? formatETB(summary.todaySales) : "ETB 0.00"}
          icon={TrendingUp}
          color="teal"
          description={summary?.todaySalesCount ? `${summary.todaySalesCount} invoices` : undefined}
          isLoading={isLoadingSummary}
        />
        <StatCard
          title="Active Batches"
          value={summary?.activeBatches || 0}
          icon={Factory}
          color="purple"
          isLoading={isLoadingSummary}
        />
        <StatCard
          title="Low Stock Items"
          value={summary?.lowStockCount || 0}
          icon={PackageX}
          color="coral"
          description="Need restocking"
          isLoading={isLoadingSummary}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-7 lg:grid-cols-8">
        <Card className="md:col-span-4 lg:col-span-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Sales Trend (Monthly)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingTrend ? (
              <div className="h-[300px] w-full flex items-center justify-center">
                <Skeleton className="h-[250px] w-full" />
              </div>
            ) : salesTrend && salesTrend.length > 0 ? (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(38 92% 48%)" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="hsl(38 92% 48%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="label"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `ETB ${(value / 1000).toFixed(0)}K`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        borderColor: "hsl(var(--border))",
                        borderRadius: "var(--radius)",
                      }}
                      itemStyle={{ color: "hsl(var(--foreground))" }}
                      formatter={(value: number) => [formatETB(value), "Sales"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(38 92% 48%)"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorValue)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No sales data available.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="md:col-span-3 lg:col-span-3 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardCheck className="h-4 w-4 text-primary" />
                Pending Approvals
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoadingApprovals ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/50">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <ClipboardCheck className="h-4 w-4 text-amber-600" />
                      GRNs
                    </div>
                    <Badge variant={pendingApprovals?.grns ? "destructive" : "secondary"}>
                      {pendingApprovals?.grns || 0}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200/50">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Boxes className="h-4 w-4 text-purple-600" />
                      Transfers
                    </div>
                    <Badge variant={pendingApprovals?.transfers ? "destructive" : "secondary"}>
                      {pendingApprovals?.transfers || 0}
                    </Badge>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="flex-1">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-primary" />
                System Alerts
              </CardTitle>
              <Link href="/notifications">
                <Button variant="ghost" size="sm" className="h-7 text-xs">
                  All <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {isLoadingAlerts ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))
                ) : alerts && alerts.length > 0 ? (
                  alerts.slice(0, 4).map((alert) => (
                    <Alert
                      key={alert.id}
                      variant={alert.severity === "critical" ? "destructive" : "default"}
                      className={`p-3 ${alert.severity === "warning" ? "border-amber-400/50 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400" : ""}`}
                    >
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle className="text-xs font-semibold mb-0.5">
                        {alert.type.replace(/_/g, " ").toUpperCase()}
                      </AlertTitle>
                      <AlertDescription className="text-xs leading-relaxed">
                        {alert.message}
                      </AlertDescription>
                    </Alert>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-6">
                    ✓ No active alerts
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
