import { useGetGrn, useApproveGrn, useRejectGrn, useMarkGrnPaid, useSubmitGrn, getListGrnsQueryKey, getGetGrnQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, CheckCircle, XCircle, DollarSign, Send, Printer, User, UserCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

const STATUS_COLORS: Record<string, string> = {
  draft: "secondary",
  pending_approval: "outline",
  approved: "default",
  rejected: "destructive",
  paid: "default",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending_approval: "Pending Approval",
  approved: "Approved",
  rejected: "Rejected",
  paid: "Paid",
};

function PrintableGrn({ grn }: { grn: any }) {
  const items: any[] = grn.items ?? [];
  const total = parseFloat(String(grn.totalCost || 0));

  return (
    <div className="bg-white text-black p-8 max-w-[800px] mx-auto font-sans text-sm" id="grn-print-area">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">GOODS RECEIVING NOTE</h1>
          <p className="text-gray-500 text-xs mt-1">Multi-Store Inventory Pro</p>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold text-gray-800">{grn.grnNumber}</div>
          <div className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-semibold uppercase ${
            grn.status === "paid" ? "bg-green-100 text-green-800" :
            grn.status === "approved" ? "bg-blue-100 text-blue-800" :
            grn.status === "rejected" ? "bg-red-100 text-red-800" :
            "bg-gray-100 text-gray-700"
          }`}>
            {STATUS_LABELS[grn.status] || grn.status}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Left: Supplier & Store */}
        <div className="space-y-4">
          <div className="border border-gray-200 rounded p-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Supplier</p>
            <p className="font-semibold text-gray-900">{grn.supplierName || "—"}</p>
          </div>
          <div className="border border-gray-200 rounded p-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Receiving Store</p>
            <p className="font-semibold text-gray-900">{grn.storeName || "—"}</p>
          </div>
        </div>
        {/* Right: GRN details */}
        <div className="space-y-2 text-xs">
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            <span className="text-gray-500 font-medium">Serial No.:</span>
            <span className="font-semibold">{grn.grnNumber}</span>
            <span className="text-gray-500 font-medium">Received Date:</span>
            <span>{grn.receivedDate}</span>
            <span className="text-gray-500 font-medium">Invoice No.:</span>
            <span>{grn.invoiceNumber || "—"}</span>
            <span className="text-gray-500 font-medium">PO Number:</span>
            <span>{grn.poNumber || "—"}</span>
            <span className="text-gray-500 font-medium">Delivery Note:</span>
            <span>{grn.deliveryNoteNumber || "—"}</span>
            <span className="text-gray-500 font-medium">Created:</span>
            <span>{grn.createdAt ? new Date(grn.createdAt).toLocaleDateString() : "—"}</span>
            {grn.approvedAt && (
              <>
                <span className="text-gray-500 font-medium">Approved:</span>
                <span>{new Date(grn.approvedAt).toLocaleDateString()}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Personnel */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="border border-gray-200 rounded p-3 bg-gray-50">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Store Manager</p>
          <p className="font-semibold text-gray-900">{grn.createdByName || "—"}</p>
        </div>
        <div className="border border-gray-200 rounded p-3 bg-gray-50">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Approved By</p>
          <p className="font-semibold text-gray-900">{grn.approverName || "Pending"}</p>
        </div>
      </div>

      {/* Items Table */}
      <table className="w-full border-collapse mb-6 text-xs">
        <thead>
          <tr className="bg-gray-900 text-white">
            <th className="text-left p-2 font-semibold">#</th>
            <th className="text-left p-2 font-semibold">Product</th>
            <th className="text-right p-2 font-semibold">Qty</th>
            <th className="text-left p-2 font-semibold">Unit</th>
            <th className="text-right p-2 font-semibold">Unit Cost (ETB)</th>
            <th className="text-right p-2 font-semibold">Total (ETB)</th>
            <th className="text-left p-2 font-semibold">Batch</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
              <td className="p-2 border-b border-gray-100">{i + 1}</td>
              <td className="p-2 border-b border-gray-100">{item.productName || `Product #${item.productId}`}</td>
              <td className="p-2 border-b border-gray-100 text-right">{parseFloat(item.quantity).toLocaleString()}</td>
              <td className="p-2 border-b border-gray-100">{item.unit}</td>
              <td className="p-2 border-b border-gray-100 text-right">{parseFloat(item.unitCost).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
              <td className="p-2 border-b border-gray-100 text-right font-medium">{parseFloat(item.totalCost).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
              <td className="p-2 border-b border-gray-100">{item.batchNumber || "—"}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-900 text-white font-bold">
            <td colSpan={5} className="p-2 text-right">TOTAL</td>
            <td className="p-2 text-right">ETB {total.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
            <td className="p-2"></td>
          </tr>
        </tfoot>
      </table>

      {grn.notes && (
        <div className="border border-gray-200 rounded p-3 mb-6">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Notes</p>
          <p className="text-gray-700">{grn.notes}</p>
        </div>
      )}
      {grn.rejectionReason && (
        <div className="border border-red-200 bg-red-50 rounded p-3 mb-6">
          <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-1">Rejection Reason</p>
          <p className="text-red-700">{grn.rejectionReason}</p>
        </div>
      )}

      {/* Signature Section */}
      <div className="grid grid-cols-3 gap-6 mt-8 pt-6 border-t border-gray-200">
        {[
          { label: "Prepared By (Store Manager)", name: grn.createdByName },
          { label: "Approved By", name: grn.approverName },
          { label: "Finance / Payment", name: grn.status === "paid" ? "Paid ✓" : "Pending" },
        ].map(({ label, name }) => (
          <div key={label} className="text-center">
            <div className="border-b-2 border-gray-300 h-12 mb-2"></div>
            <p className="text-xs font-medium text-gray-700">{name || "_______________"}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <p className="text-center text-gray-400 text-[10px] mt-6">
        Generated by Multi-Store Inventory Pro · {new Date().toLocaleString()}
      </p>
    </div>
  );
}

export default function GrnDetail({ id }: { id: string }) {
  const grnId = parseInt(id, 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNotes, setRejectNotes] = useState("");
  const [printOpen, setPrintOpen] = useState(false);

  const { data: grn, isLoading } = useGetGrn(grnId, { query: { enabled: !!grnId, queryKey: ["getGrn", grnId] } });
  const submitGrn = useSubmitGrn();
  const approveGrn = useApproveGrn();
  const rejectGrn = useRejectGrn();
  const markPaid = useMarkGrnPaid();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListGrnsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetGrnQueryKey(grnId) });
  };

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

  const handlePrint = () => {
    const printArea = document.getElementById("grn-print-area");
    if (!printArea) return;
    const html = `<!DOCTYPE html><html><head><title>${grn?.grnNumber || "GRN"}</title><style>
      body { font-family: Arial, sans-serif; font-size: 12px; color: #111; margin: 0; padding: 0; }
      * { box-sizing: border-box; }
    </style></head><body>${printArea.outerHTML}</body></html>`;
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => { win.print(); }, 400);
    }
  };

  if (isLoading) return <div className="p-8 space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  if (!grn) return <div className="p-8 text-muted-foreground">GRN not found.</div>;

  const total = parseFloat(String(grn.totalCost || 0));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/grn")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">{grn.grnNumber}</h1>
            <Badge variant={STATUS_COLORS[grn.status] as any} className="uppercase text-xs">
              {STATUS_LABELS[grn.status] || grn.status}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-0.5">
            {grn.supplierName} · {grn.storeName}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setPrintOpen(true)}>
            <Printer className="h-4 w-4 mr-2" /> Print / Preview
          </Button>
          {grn.status === "draft" && (
            <Button onClick={handleSubmit} disabled={submitGrn.isPending} size="sm">
              <Send className="h-4 w-4 mr-2" /> Submit for Approval
            </Button>
          )}
          {grn.status === "pending_approval" && (
            <>
              <Button variant="destructive" size="sm" onClick={() => setRejectOpen(true)}>
                <XCircle className="h-4 w-4 mr-2" /> Reject
              </Button>
              <Button size="sm" onClick={handleApprove} disabled={approveGrn.isPending}>
                <CheckCircle className="h-4 w-4 mr-2" /> Approve
              </Button>
            </>
          )}
          {grn.status === "approved" && (
            <Button size="sm" onClick={handlePay} disabled={markPaid.isPending}>
              <DollarSign className="h-4 w-4 mr-2" /> Mark as Paid
            </Button>
          )}
        </div>
      </div>

      {/* Personnel Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border-amber-200/60 bg-amber-50/50 dark:bg-amber-950/10">
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <User className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Store Manager (Created By)</p>
              <p className="text-sm font-semibold">{(grn as any).createdByName || "—"}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-teal-200/60 bg-teal-50/50 dark:bg-teal-950/10">
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
              <UserCheck className="h-4 w-4 text-teal-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Approved By</p>
              <p className="text-sm font-semibold">{(grn as any).approverName || (grn.status === "pending_approval" ? "Awaiting approval" : "—")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Serial No.", value: grn.grnNumber },
          { label: "Received Date", value: grn.receivedDate },
          { label: "Invoice No.", value: grn.invoiceNumber ?? "—" },
          { label: "Total Cost", value: `ETB ${total.toLocaleString("en-US", { minimumFractionDigits: 2 })}` },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground font-medium">{label}</p>
              <p className="text-sm font-semibold mt-1">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Items Table */}
      <Card>
        <CardHeader><CardTitle className="text-base">Line Items</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>#</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Unit Cost (ETB)</TableHead>
                <TableHead className="text-right">Total (ETB)</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Expiry</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {((grn as any).items ?? []).map((item: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium">{item.productName || `Product #${item.productId}`}</TableCell>
                  <TableCell className="text-right">{parseFloat(item.quantity).toLocaleString()}</TableCell>
                  <TableCell>{item.unit}</TableCell>
                  <TableCell className="text-right">
                    {parseFloat(item.unitCost).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {parseFloat(item.totalCost).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>{item.batchNumber ?? "—"}</TableCell>
                  <TableCell>{item.expiryDate ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex justify-end p-4 border-t bg-muted/30">
            <div className="flex gap-8 text-sm font-bold">
              <span>Total</span>
              <span>ETB {total.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {grn.notes && (
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground font-medium mb-1">Notes</p>
            <p className="text-sm">{grn.notes}</p>
          </CardContent>
        </Card>
      )}

      {grn.rejectionReason && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="pt-4">
            <p className="text-xs text-destructive font-semibold mb-1">Rejection Reason</p>
            <p className="text-sm">{grn.rejectionReason}</p>
          </CardContent>
        </Card>
      )}

      {/* Reject Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject GRN</DialogTitle></DialogHeader>
          <Textarea
            placeholder="Reason for rejection..."
            value={rejectNotes}
            onChange={(e) => setRejectNotes(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={rejectGrn.isPending}>
              Confirm Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print Preview Dialog */}
      <Dialog open={printOpen} onOpenChange={setPrintOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-4 w-4" />
              GRN Document — {grn.grnNumber}
            </DialogTitle>
          </DialogHeader>
          <div className="border rounded-lg overflow-hidden">
            <PrintableGrn grn={grn} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrintOpen(false)}>Close</Button>
            <Button onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" /> Print / Save PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
