import { useGetGrn, useApproveGrn, useRejectGrn, useMarkGrnPaid, useSubmitGrn, getListGrnsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, CheckCircle, XCircle, DollarSign, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const STATUS_COLORS: Record<string, string> = {
  draft: "secondary",
  pending_approval: "outline",
  approved: "default",
  rejected: "destructive",
  paid: "default",
};

export default function GrnDetail({ id }: { id: string }) {
  const grnId = parseInt(id, 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNotes, setRejectNotes] = useState("");

  const { data: grn, isLoading } = useGetGrn(grnId, { query: { enabled: !!grnId, queryKey: ['getGrn', grnId] } });
  const submitGrn = useSubmitGrn();
  const approveGrn = useApproveGrn();
  const rejectGrn = useRejectGrn();
  const markPaid = useMarkGrnPaid();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListGrnsQueryKey() });

  const handleSubmit = () => {
    submitGrn.mutate({ id: grnId }, {
      onSuccess: () => { toast({ title: "GRN submitted for approval" }); invalidate(); },
    });
  };

  const handleApprove = () => {
    approveGrn.mutate({ id: grnId, data: {} }, {
      onSuccess: () => { toast({ title: "GRN approved — inventory updated" }); invalidate(); },
    });
  };

  const handleReject = () => {
    rejectGrn.mutate({ id: grnId, data: { notes: rejectNotes } }, {
      onSuccess: () => { toast({ title: "GRN rejected" }); setRejectOpen(false); invalidate(); },
    });
  };

  const handlePay = () => {
    markPaid.mutate({ id: grnId }, {
      onSuccess: () => { toast({ title: "GRN marked as paid" }); invalidate(); },
    });
  };

  if (isLoading) return <div className="p-8 space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  if (!grn) return <div className="p-8 text-muted-foreground">GRN not found.</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/grn")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{grn.grnNumber}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{grn.supplierName} · {grn.storeName}</p>
        </div>
        <Badge variant={STATUS_COLORS[grn.status] as any} data-testid="status-badge">{grn.status.replace(/_/g, " ").toUpperCase()}</Badge>
        <div className="flex gap-2">
          {grn.status === "draft" && (
            <Button onClick={handleSubmit} disabled={submitGrn.isPending} data-testid="button-submit">
              <Send className="h-4 w-4 mr-2" />Submit for Approval
            </Button>
          )}
          {grn.status === "pending_approval" && (
            <>
              <Button variant="destructive" onClick={() => setRejectOpen(true)} data-testid="button-reject">
                <XCircle className="h-4 w-4 mr-2" />Reject
              </Button>
              <Button onClick={handleApprove} disabled={approveGrn.isPending} data-testid="button-approve">
                <CheckCircle className="h-4 w-4 mr-2" />Approve
              </Button>
            </>
          )}
          {grn.status === "approved" && (
            <Button onClick={handlePay} disabled={markPaid.isPending} data-testid="button-pay">
              <DollarSign className="h-4 w-4 mr-2" />Mark as Paid
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Received Date", value: grn.receivedDate },
          { label: "Invoice No.", value: grn.invoiceNumber ?? "—" },
          { label: "PO Number", value: grn.poNumber ?? "—" },
          { label: "Total Cost", value: `ETB ${parseFloat(String(grn.totalCost)).toLocaleString()}` },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-sm font-semibold mt-1" data-testid={`text-${label.toLowerCase().replace(/\s+/g, "-")}`}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Line Items</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Unit Cost</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Expiry</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(grn.items ?? []).map((item: any, i: number) => (
                <TableRow key={i} data-testid={`row-grn-item-${i}`}>
                  <TableCell>{item.productId}</TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>{item.unit}</TableCell>
                  <TableCell className="text-right">ETB {parseFloat(item.unitCost).toLocaleString()}</TableCell>
                  <TableCell className="text-right">ETB {parseFloat(item.totalCost).toLocaleString()}</TableCell>
                  <TableCell>{item.batchNumber ?? "—"}</TableCell>
                  <TableCell>{item.expiryDate ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {grn.rejectionReason && (
        <Card className="border-destructive/40">
          <CardContent className="pt-4">
            <p className="text-xs text-destructive font-medium">Rejection Reason</p>
            <p className="text-sm mt-1">{grn.rejectionReason}</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject GRN</DialogTitle></DialogHeader>
          <Textarea
            placeholder="Reason for rejection..."
            value={rejectNotes}
            onChange={e => setRejectNotes(e.target.value)}
            rows={3}
            data-testid="textarea-reject-reason"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={rejectGrn.isPending} data-testid="button-confirm-reject">
              Confirm Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
