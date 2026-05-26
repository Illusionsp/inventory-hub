import { useState } from "react";
import {
  useGetStoreRequest,
  useApproveStoreRequest,
  useRejectStoreRequest,
  useSendStoreRequest,
  useReceiveStoreRequest,
  useListStores,
  getListStoreRequestsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CheckCircle, XCircle, Send, PackageCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

export default function StoreRequestDetail({ id }: { id: string }) {
  const requestId = parseInt(id, 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const { data: request, isLoading } = useGetStoreRequest(requestId, {
    query: { enabled: !!requestId, queryKey: ["getStoreRequest", requestId] },
  });
  const { data: stores } = useListStores();

  const approveRequest = useApproveStoreRequest();
  const rejectRequest = useRejectStoreRequest();
  const sendRequest = useSendStoreRequest();
  const receiveRequest = useReceiveStoreRequest();

  const storeName = (id: number | null | undefined) =>
    stores?.find(s => s.id === id)?.name ?? `Store #${id}`;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListStoreRequestsQueryKey() });
    queryClient.invalidateQueries({ queryKey: ["getStoreRequest", requestId] });
  };

  if (isLoading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!request) {
    return <div className="p-8 text-muted-foreground">Store request not found.</div>;
  }

  const userStoreId = user?.storeId;
  const isReceivingStore = userStoreId === request.receivingStoreId;
  const isRequestingStore = userStoreId === request.requestingStoreId;
  const isSuperAdmin = user?.role === "super_admin";

  const canApproveReject = (isReceivingStore || isSuperAdmin) && request.status === "pending";
  const canSend = (isRequestingStore || isSuperAdmin) && request.status === "approved";
  const canReceive = (isReceivingStore || isSuperAdmin) && request.status === "sent";

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/store-requests")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{request.requestNumber}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {storeName(request.requestingStoreId)} → {storeName(request.receivingStoreId)}
          </p>
        </div>
        <Badge variant={STATUS_BADGE[request.status] ?? "outline"}>
          {STATUS_LABEL[request.status] ?? request.status}
        </Badge>
      </div>

      {/* Action Buttons */}
      {(canApproveReject || canSend || canReceive) && (
        <div className="flex gap-2 flex-wrap">
          {canApproveReject && (
            <>
              <Button
                variant="destructive"
                onClick={() => setRejectOpen(true)}
                data-testid="button-reject"
              >
                <XCircle className="h-4 w-4 mr-2" />Reject
              </Button>
              <Button
                onClick={() => {
                  approveRequest.mutate(
                    { id: requestId },
                    {
                      onSuccess: () => { toast({ title: "Request approved" }); invalidate(); },
                      onError: () => toast({ title: "Failed to approve", variant: "destructive" }),
                    },
                  );
                }}
                disabled={approveRequest.isPending}
                data-testid="button-approve"
              >
                <CheckCircle className="h-4 w-4 mr-2" />Approve
              </Button>
            </>
          )}
          {canSend && (
            <Button
              onClick={() => {
                sendRequest.mutate(
                  { id: requestId },
                  {
                    onSuccess: () => { toast({ title: "Items marked as sent" }); invalidate(); },
                    onError: () => toast({ title: "Failed to mark as sent", variant: "destructive" }),
                  },
                );
              }}
              disabled={sendRequest.isPending}
              data-testid="button-send"
            >
              <Send className="h-4 w-4 mr-2" />Mark as Sent
            </Button>
          )}
          {canReceive && (
            <Button
              onClick={() => {
                receiveRequest.mutate(
                  { id: requestId },
                  {
                    onSuccess: () => { toast({ title: "Items marked as received" }); invalidate(); },
                    onError: () => toast({ title: "Failed to mark as received", variant: "destructive" }),
                  },
                );
              }}
              disabled={receiveRequest.isPending}
              data-testid="button-receive"
            >
              <PackageCheck className="h-4 w-4 mr-2" />Mark as Received
            </Button>
          )}
        </div>
      )}

      {/* Status Timeline */}
      <Card>
        <CardHeader><CardTitle className="text-base">Status Timeline</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 flex-wrap">
            {["pending", "approved", "sent", "received"].map((s, i, arr) => {
              const statuses = ["pending", "approved", "sent", "received"];
              const currentIdx = statuses.indexOf(request.status === "rejected" ? "pending" : request.status);
              const stepIdx = statuses.indexOf(s);
              const isActive = s === request.status;
              const isDone = stepIdx < currentIdx || (request.status !== "rejected" && stepIdx <= currentIdx);
              const isRejected = request.status === "rejected" && s === "pending";

              return (
                <div key={s} className="flex items-center gap-2">
                  <div
                    className={`px-3 py-1 rounded-full text-xs font-medium border ${
                      isRejected
                        ? "bg-destructive/10 text-destructive border-destructive/30"
                        : isActive
                          ? "bg-primary text-primary-foreground border-primary"
                          : isDone
                            ? "bg-muted text-muted-foreground border-muted-foreground/30"
                            : "border-muted text-muted-foreground/50"
                    }`}
                  >
                    {isRejected ? "Rejected" : STATUS_LABEL[s]}
                  </div>
                  {i < arr.length - 1 && (
                    <div className={`h-px w-6 ${isDone && !isRejected ? "bg-primary" : "bg-muted"}`} />
                  )}
                </div>
              );
            })}
          </div>
          {request.sentAt && (
            <p className="text-xs text-muted-foreground mt-2">
              Sent: {new Date(request.sentAt).toLocaleString()}
            </p>
          )}
          {request.receivedAt && (
            <p className="text-xs text-muted-foreground mt-1">
              Received: {new Date(request.receivedAt).toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader><CardTitle className="text-base">Requested Items</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(request.items ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                    No items
                  </TableCell>
                </TableRow>
              ) : (request.items ?? []).map((item: any, i: number) => (
                <TableRow key={i} data-testid={`row-item-${i}`}>
                  <TableCell>{item.productName ?? `Product #${item.productId}`}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{item.productSku ?? "—"}</TableCell>
                  <TableCell className="text-right font-mono">{parseFloat(String(item.quantity)).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Notes */}
      {request.notes && (
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground mb-1">Notes</p>
            <p className="text-sm">{request.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Rejection Reason */}
      {request.rejectionReason && (
        <Card className="border-destructive/40">
          <CardContent className="pt-4">
            <p className="text-xs text-destructive font-medium mb-1">Rejection Reason</p>
            <p className="text-sm">{request.rejectionReason}</p>
          </CardContent>
        </Card>
      )}

      {/* Reject Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Store Request</DialogTitle></DialogHeader>
          <Textarea
            placeholder="Reason for rejection (optional)..."
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            rows={3}
            data-testid="textarea-reject-reason"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                rejectRequest.mutate(
                  { id: requestId, data: { reason: rejectReason } as any },
                  {
                    onSuccess: () => {
                      toast({ title: "Request rejected" });
                      setRejectOpen(false);
                      invalidate();
                    },
                    onError: () => toast({ title: "Failed to reject", variant: "destructive" }),
                  },
                );
              }}
              disabled={rejectRequest.isPending}
              data-testid="button-confirm-reject"
            >
              Confirm Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
