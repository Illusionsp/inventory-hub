import { useListNotifications, useMarkNotificationRead, useMarkAllNotificationsRead, getListNotificationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, CheckCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const TYPE_BADGE: Record<string, string> = {
  low_stock: "destructive", pending_approval: "outline", overdue_payment: "destructive",
  expiry_warning: "secondary", high_wastage: "secondary", delayed_transfer: "outline",
};

export default function Notifications() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useListNotifications({ unreadOnly: false });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });

  const handleMarkAll = () => {
    markAllRead.mutate(undefined, {
      onSuccess: () => { toast({ title: "All marked as read" }); invalidate(); },
    });
  };

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

      <Card>
        <CardContent className="p-0 divide-y">
          {isLoading ? (
            <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : (data?.data ?? []).length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Bell className="mx-auto h-10 w-10 mb-3 opacity-20" />
              <p className="text-sm">No notifications</p>
            </div>
          ) : (data?.data ?? []).map((n: any) => (
            <div
              key={n.id}
              className={cn("flex items-start gap-4 p-4 cursor-pointer hover:bg-muted/50 transition-colors", !n.isRead && "bg-primary/5")}
              onClick={() => { if (!n.isRead) markRead.mutate({ id: n.id }, { onSuccess: invalidate }); }}
              data-testid={`notification-${n.id}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-medium">{n.title}</p>
                  <Badge variant={TYPE_BADGE[n.type] as any} className="text-xs">{n.type.replace(/_/g, " ")}</Badge>
                  {!n.isRead && <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />}
                </div>
                <p className="text-sm text-muted-foreground">{n.message}</p>
                <p className="text-xs text-muted-foreground/60 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
