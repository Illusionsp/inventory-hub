import { useState } from "react";
import { useListStoreRequests, useListStores, ListStoreRequestsParams } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, SendHorizonal } from "lucide-react";

const STATUS_BADGE: Record<string, "outline" | "secondary" | "destructive" | "default"> = {
  pending: "outline",
  approved: "secondary",
  rejected: "destructive",
  sent: "default",
  received: "default",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  sent: "Sent",
  received: "Received",
};

export default function StoreRequestList() {
  const [, setLocation] = useLocation();
  const { hasPermission } = useAuth();
  const [status, setStatus] = useState("all");
  const [direction, setDirection] = useState("all");
  const [page, setPage] = useState(1);

  const params: ListStoreRequestsParams = {
    page,
    ...(status !== "all" ? { status: status as any } : {}),
    ...(direction !== "all" ? { direction: direction as any } : {}),
  };

  const { data, isLoading } = useListStoreRequests(params);
  const { data: stores } = useListStores();

  const storeName = (id: number) => stores?.find(s => s.id === id)?.name ?? `Store #${id}`;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Store Requests</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Request items from another store</p>
        </div>
        {hasPermission("can_create_store_requests") && (
          <Button onClick={() => setLocation("/store-requests/new")} data-testid="button-new-store-request">
            <Plus className="h-4 w-4 mr-2" />New Request
          </Button>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        <Select value={status} onValueChange={v => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-44" data-testid="select-status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="received">Received</SelectItem>
          </SelectContent>
        </Select>

        <Select value={direction} onValueChange={v => { setDirection(v); setPage(1); }}>
          <SelectTrigger className="w-44" data-testid="select-direction">
            <SelectValue placeholder="All directions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Requests</SelectItem>
            <SelectItem value="outgoing">Outgoing (Sent)</SelectItem>
            <SelectItem value="incoming">Incoming (Received)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request No.</TableHead>
                  <TableHead>From Store</TableHead>
                  <TableHead>To Store</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      <SendHorizonal className="mx-auto h-8 w-8 mb-2 opacity-30" />
                      No store requests found
                    </TableCell>
                  </TableRow>
                ) : (data?.data ?? []).map((r: any) => (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setLocation(`/store-requests/${r.id}`)}
                    data-testid={`row-request-${r.id}`}
                  >
                    <TableCell className="font-mono text-sm font-semibold">{r.requestNumber}</TableCell>
                    <TableCell>{storeName(r.requestingStoreId)}</TableCell>
                    <TableCell>{storeName(r.receivingStoreId)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_BADGE[r.status] ?? "outline"}>
                        {STATUS_LABEL[r.status] ?? r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={e => { e.stopPropagation(); setLocation(`/store-requests/${r.id}`); }}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {(data?.total ?? 0) > 20 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground py-2">Page {page}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={(page * 20) >= (data?.total ?? 0)}
            onClick={() => setPage(p => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
