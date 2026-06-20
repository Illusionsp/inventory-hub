import { useState } from "react";
import { useListNotifications, useMarkNotificationRead, useMarkAllNotificationsRead, getListNotificationsQueryKey } from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, CheckCheck, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useNotificationStream } from "@/hooks/useNotificationStream";

const TYPE_META: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  store_request: { label: "Store Request", variant: "outline" },
  grn_pending: { label: "GRN Pending", variant: "secondary" },
  grn_approved: { label: "GRN Approved", variant: "default" },
  grn_rejected: { label: "GRN Rejected", variant: "destructive" },
  production_completed: { label: "Batch Completed", variant: "default" },
  dispatch_received: { label: "Dispatch Received", variant: "default" },
  low_stock: { label: "Low Stock", variant: "destructive" },
  pending_approval: { label: "Pending Approval", variant: "outline" },
  overdue_payment: { label: "Overdue Payment", variant: "destructive" },
  transfer_pending: { label: "Transfer Request", variant: "outline" },
  transfer_approved: { label: "Transfer Approved", variant: "default" },
  transfer_rejected: { label: "Transfer Rejected", variant: "destructive" },
  transfer_shipped: { label: "Items Shipped", variant: "secondary" },
  transfer_received: { label: "Transfer Received", variant: "default" },
  credit_sale: { label: "Credit Sale", variant: "secondary" },
};

function getEntityPath(entityType: string | null, entityId: number | null): string | null {
  if (!entityType || !entityId) return null;
  switch (entityType) {
    case "store_request": return `/store-requests/${entityId}`;
    case "grn": return `/grn/${entityId}`;
    case "production_batch": return `/production/${entityId}`;
    case "transfer": return `/transfers/${entityId}`;
    case "sale": return `/sales/${entityId}`;
    default: return null;
  }
}

export default function Notifications() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<"unread" | "all">("unread");
  const [page, setPage] = useState(1);

  useNotificationStream();

  const { data, isLoading } = useListNotifications(
    { unreadOnly: tab === "unread", page },
    { query: { refetchInterval: 15_000, queryKey: ["notifications", tab, page] } },
  );
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["notifications"] });

  const handleMarkAll = () => {
    markAllRead.mutate(undefined, {
      onSuccess: () => { toast({ title: "All marked as read" }); invalidate(); },
    });
  };

  const handleClick = (n: any) => {
    if (!n.isRead) {
      markRead.mutate({ id: n.id }, { onSuccess: invalidate });
    }
    const path = getEntityPath(n.entityType, n.entityId);
    if (path) navigate(path);
  };

  const notifications = data?.data ?? [];
  const limitNum = 50;
  const total = data?.total ?? 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {(data?.unreadCount ?? 0) > 0 ? `${data?.unreadCount} unread` : "All caught up"}
          </p>
        </div>
        {(data?.unreadCount ?? 0) > 0 && (
          <Button variant="outline" onClick={handleMarkAll} disabled={markAllRead.isPending} data-testid="button-mark-all-read">
            <CheckCheck className="h-4 w-4 mr-2" />Mark All Read
          </Button>
        )}
      </div>

      <Tabs value={tab} onValueChange={(v) => { setTab(v as "unread" | "all"); setPage(1); }} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="unread">Unread</TabsTrigger>
          <TabsTrigger value="all">All Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value={tab}>
          <Card>
            <CardContent className="p-0 divide-y">
              {isLoading ? (
                <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
              ) : notifications.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">
                  <Bell className="mx-auto h-10 w-10 mb-3 opacity-20" />
                  <p className="text-sm">
                    {tab === "unread" ? "No unread notifications!" : "No notifications yet"}
                  </p>
                </div>
              ) : notifications.map((n: any) => {
                const meta = TYPE_META[n.type] ?? { label: n.type.replace(/_/g, " "), variant: "outline" as const };
                const path = getEntityPath(n.entityType, n.entityId);
                return (
                  <div
                    key={n.id}
                    className={cn(
                      "flex items-start gap-4 p-4 transition-colors",
                      !n.isRead && "bg-primary/5",
                      path ? "cursor-pointer hover:bg-muted/50" : "",
                    )}
                    onClick={() => handleClick(n)}
                    data-testid={`notification-${n.id}`}
                  >
                    <div className="mt-1.5 shrink-0">
                      {!n.isRead
                        ? <span className="h-2.5 w-2.5 rounded-full bg-primary block" />
                        : <span className="h-2.5 w-2.5 rounded-full bg-muted block" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <p className="text-sm font-semibold">{n.title}</p>
                        <Badge variant={meta.variant} className="text-[10px] px-1.5 py-0">{meta.label}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground leading-snug">{n.message}</p>
                      <p className="text-xs text-muted-foreground/50 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                    </div>

                    {path && (
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 shrink-0 mt-0.5 text-muted-foreground hover:text-primary"
                        onClick={e => { e.stopPropagation(); handleClick(n); }}
                        title="Open"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
        {total > limitNum && (
          <div className="flex justify-center gap-2 mt-4">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page * limitNum >= total} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        )}
      </Tabs>
    </div>
  );
}
