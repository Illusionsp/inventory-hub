import { useState } from "react";
import {
  useListStoreRequests,
  useListTransfers,
  useListStores,
  ListStoreRequestsParams,
  ListTransfersStatus,
} from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, SendHorizonal, ArrowRightLeft } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Status maps ────────────────────────────────────────────────────────────

const REQ_STATUS_BADGE: Record<string, "outline" | "secondary" | "destructive" | "default"> = {
  pending: "outline",
  approved: "secondary",
  rejected: "destructive",
  sent: "default",
  received: "default",
};
const REQ_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  sent: "Sent",
  received: "Received",
};

const TRF_STATUS_BADGE: Record<string, "outline" | "secondary" | "destructive" | "default"> = {
  pending: "outline",
  approved: "secondary",
  rejected: "destructive",
  shipped: "default",
  received: "default",
};

// ── Tab components ─────────────────────────────────────────────────────────

function StoreRequestsTab() {
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Request items from another store</p>
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
                      <Badge variant={REQ_STATUS_BADGE[r.status] ?? "outline"}>
                        {REQ_STATUS_LABEL[r.status] ?? r.status}
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
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <span className="text-sm text-muted-foreground py-2">Page {page}</span>
          <Button variant="outline" size="sm" disabled={(page * 20) >= (data?.total ?? 0)} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}

function TransfersTab() {
  const [, setLocation] = useLocation();
  const { hasPermission } = useAuth();
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useListTransfers({ status: status !== "all" ? status as ListTransfersStatus : undefined, page });
  const { data: stores } = useListStores();

  const storeName = (id: number | null | undefined) => {
    if (!id) return "—";
    return stores?.find(s => s.id === id)?.name ?? `Store #${id}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Manage inter-store transfer requests</p>
        {hasPermission("can_create_store_requests") && (
          <Button onClick={() => setLocation("/transfers/new")} data-testid="button-new-transfer">
            <Plus className="h-4 w-4 mr-2" />New Transfer
          </Button>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        <Select value={status} onValueChange={v => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-44" data-testid="select-status-transfer">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="shipped">Shipped</SelectItem>
            <SelectItem value="received">Received</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transfer No.</TableHead>
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
                      <ArrowRightLeft className="mx-auto h-8 w-8 mb-2 opacity-30" />
                      No transfers found
                    </TableCell>
                  </TableRow>
                ) : (data?.data ?? []).map((t: any) => (
                  <TableRow
                    key={t.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setLocation(`/transfers/${t.id}`)}
                    data-testid={`row-transfer-${t.id}`}
                  >
                    <TableCell className="font-mono text-sm font-semibold">{t.transferNumber}</TableCell>
                    <TableCell>{storeName(t.fromStoreId)}</TableCell>
                    <TableCell>{storeName(t.toStoreId)}</TableCell>
                    <TableCell>
                      <Badge variant={TRF_STATUS_BADGE[t.status] as any}>
                        {t.status.charAt(0).toUpperCase() + t.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{new Date(t.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setLocation(`/transfers/${t.id}`); }}>View</Button>
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
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)} data-testid="button-prev-page">Previous</Button>
          <span className="text-sm text-muted-foreground py-2">Page {page}</span>
          <Button variant="outline" size="sm" disabled={(page * 20) >= (data?.total ?? 0)} onClick={() => setPage(p => p + 1)} data-testid="button-next-page">Next</Button>
        </div>
      )}
    </div>
  );
}

// ── Unified Requesting page ────────────────────────────────────────────────

type Tab = "requests" | "transfers";

export default function RequestingPage() {
  const [location] = useLocation();

  // If the user arrived here via /transfers/* redirect, default to the transfers tab
  const defaultTab: Tab = location.startsWith("/transfers") ? "transfers" : "requests";
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "requests", label: "Store Requests", icon: SendHorizonal },
    { id: "transfers", label: "Store Transfers", icon: ArrowRightLeft },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Requesting</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Manage store-to-store requests and inter-store transfers
        </p>
      </div>

      {/* Tab strip */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "requests" ? <StoreRequestsTab /> : <TransfersTab />}
    </div>
  );
}
