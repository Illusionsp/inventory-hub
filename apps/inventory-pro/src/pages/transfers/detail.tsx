import { useGetTransfer, useApproveTransfer, useRejectTransfer, useListStores, getListTransfersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const STATUS_BADGE: Record<string, string> = {
  pending: "outline", approved: "secondary", rejected: "destructive", shipped: "default", received: "default",
};

export default function TransferDetail({ id }: { id: string }) {
  const transferId = parseInt(id, 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNotes, setRejectNotes] = useState("");

  const { data: transfer, isLoading } = useGetTransfer(transferId, { query: { enabled: !!transferId, queryKey: ['getTransfer', transferId] } });
  const { data: stores } = useListStores();
  const approveTransfer = useApproveTransfer();
  const rejectTransfer = useRejectTransfer();

  const storeName = (id: number | null | undefined) => stores?.find(s => s.id === id)?.name ?? `Store #${id}`;
  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListTransfersQueryKey() });

  if (isLoading) return <div className="p-8 space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  if (!transfer) return <div className="p-8 text-muted-foreground">Transfer not found.</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/transfers")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{transfer.transferNumber}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{storeName(transfer.fromStoreId)} → {storeName(transfer.toStoreId)}</p>
        </div>
        <Badge variant={STATUS_BADGE[transfer.status] as any}>{transfer.status.toUpperCase()}</Badge>
        {transfer.status === "pending" && (
          <div className="flex gap-2">
            <Button variant="destructive" onClick={() => setRejectOpen(true)} data-testid="button-reject">
              <XCircle className="h-4 w-4 mr-2" />Reject
            </Button>
            <Button onClick={() => {
              approveTransfer.mutate({ id: transferId, data: {} as any }, {
                onSuccess: () => { toast({ title: "Transfer approved" }); invalidate(); },
              });
            }} disabled={approveTransfer.isPending} data-testid="button-approve">
              <CheckCircle className="h-4 w-4 mr-2" />Approve
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Transfer Items</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Requested Qty</TableHead>
                <TableHead className="text-right">Approved Qty</TableHead>
                <TableHead className="text-right">Shipped Qty</TableHead>
                <TableHead className="text-right">Received Qty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(transfer.items ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No items</TableCell></TableRow>
              ) : (transfer.items ?? []).map((item: any, i: number) => (
                <TableRow key={i} data-testid={`row-transfer-item-${i}`}>
                  <TableCell>Product #{item.productId}</TableCell>
                  <TableCell className="text-right">{item.requestedQty}</TableCell>
                  <TableCell className="text-right">{item.approvedQty ?? "—"}</TableCell>
                  <TableCell className="text-right">{item.shippedQty ?? "—"}</TableCell>
                  <TableCell className="text-right">{item.receivedQty ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {transfer.notes && (
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Notes</p>
            <p className="text-sm mt-1">{transfer.notes}</p>
          </CardContent>
        </Card>
      )}

      {transfer.rejectionReason && (
        <Card className="border-destructive/40">
          <CardContent className="pt-4">
            <p className="text-xs text-destructive font-medium">Rejection Reason</p>
            <p className="text-sm mt-1">{transfer.rejectionReason}</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Transfer</DialogTitle></DialogHeader>
          <Textarea placeholder="Reason for rejection..." value={rejectNotes} onChange={e => setRejectNotes(e.target.value)} rows={3} data-testid="textarea-reject-reason" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => {
              rejectTransfer.mutate({ id: transferId, data: { notes: rejectNotes } as any }, {
                onSuccess: () => { toast({ title: "Transfer rejected" }); setRejectOpen(false); invalidate(); },
              });
            }} disabled={rejectTransfer.isPending} data-testid="button-confirm-reject">
              Confirm Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
