import React from "react";
import { Link } from "wouter";
import {
  useGetDashboardSummary,
  useGetDashboardSalesTrend,
  useGetDashboardTopProducts,
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
  CreditCard,
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

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  isLoading,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description?: string;
  isLoading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-7 w-20" />
        ) : (
          <div className="text-2xl font-bold">{value}</div>
        )}
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();
  const { data: salesTrend, isLoading: isLoadingTrend } = useGetDashboardSalesTrend({ period: 'monthly' });
  const { data: alerts, isLoading: isLoadingAlerts } = useGetDashboardAlerts();
  const { data: pendingApprovals, isLoading: isLoadingApprovals } = useGetDashboardPendingApprovals();

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);

  return (
    <div className="space-y-6">
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
          value={summary ? formatCurrency(summary.totalStockValue) : "$0.00"}
          icon={CircleDollarSign}
          isLoading={isLoadingSummary}
        />
        <StatCard
          title="Today's Sales"
          value={summary ? formatCurrency(summary.todaySales) : "$0.00"}
          icon={TrendingUp}
          description={summary?.todaySalesCount ? `${summary.todaySalesCount} invoices` : undefined}
          isLoading={isLoadingSummary}
        />
        <StatCard
          title="Active Batches"
          value={summary?.activeBatches || 0}
          icon={Factory}
          isLoading={isLoadingSummary}
        />
        <StatCard
          title="Low Stock Items"
          value={summary?.lowStockCount || 0}
          icon={PackageX}
          description="Needs attention"
          isLoading={isLoadingSummary}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-7 lg:grid-cols-8">
        <Card className="md:col-span-4 lg:col-span-5">
          <CardHeader>
            <CardTitle>Sales Trend (30 Days)</CardTitle>
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
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
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
                      tickFormatter={(value) => `$${value}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        borderColor: "hsl(var(--border))",
                        borderRadius: "var(--radius)",
                      }}
                      itemStyle={{ color: "hsl(var(--foreground))" }}
                      formatter={(value: number) => [formatCurrency(value), "Sales"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
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

        <div className="md:col-span-3 lg:col-span-3 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Pending Approvals</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingApprovals ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                      Goods Receiving Notes
                    </div>
                    <Badge variant={pendingApprovals?.grns ? "destructive" : "secondary"}>
                      {pendingApprovals?.grns || 0}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Boxes className="h-4 w-4 text-muted-foreground" />
                      Store Transfers
                    </div>
                    <Badge variant={pendingApprovals?.transfers ? "destructive" : "secondary"}>
                      {pendingApprovals?.transfers || 0}
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="flex-1">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle>System Alerts</CardTitle>
              <Link href="/notifications">
                <Button variant="ghost" size="sm" className="h-8 text-xs">
                  View all <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {isLoadingAlerts ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))
                ) : alerts && alerts.length > 0 ? (
                  alerts.slice(0, 4).map((alert) => (
                    <Alert
                      key={alert.id}
                      variant={alert.severity === "critical" ? "destructive" : "default"}
                      className={`p-3 ${alert.severity === "warning" ? "border-orange-500/50 bg-orange-500/10 text-orange-600 dark:text-orange-400" : ""}`}
                    >
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle className="text-xs font-semibold mb-1">
                        {alert.type.replace(/_/g, " ").toUpperCase()}
                      </AlertTitle>
                      <AlertDescription className="text-xs">
                        {alert.message}
                      </AlertDescription>
                    </Alert>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    No active alerts.
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
