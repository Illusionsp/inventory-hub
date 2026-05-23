import { useState } from "react";
import { useListTransfers, useListStores, ListTransfersStatus } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, ArrowRightLeft, Search } from "lucide-react";

const STATUS_BADGE: Record<string, string> = {
  pending: "outline",
  approved: "secondary",
  rejected: "destructive",
  shipped: "default",
  received: "default",
};

export default function TransferList() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useListTransfers({ status: status !== "all" ? status as ListTransfersStatus : undefined, page });
  const { data: stores } = useListStores();

  const storeName = (id: number | null | undefined) => {
    if (!id) return "—";
    return stores?.find(s => s.id === id)?.name ?? `Store #${id}`;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Store Transfers</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage inter-store transfer requests</p>
        </div>
        <Button onClick={() => setLocation("/transfers/new")} data-testid="button-new-transfer">
          <Plus className="h-4 w-4 mr-2" />New Transfer
        </Button>
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
                  <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setLocation(`/transfers/${t.id}`)} data-testid={`row-transfer-${t.id}`}>
                    <TableCell className="font-mono text-sm font-semibold">{t.transferNumber}</TableCell>
                    <TableCell>{storeName(t.fromStoreId)}</TableCell>
                    <TableCell>{storeName(t.toStoreId)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_BADGE[t.status] as any}>{t.status.charAt(0).toUpperCase() + t.status.slice(1)}</Badge>
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
