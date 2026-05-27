import { useState } from "react";
import { useGetSale, useCreatePayment, getListSalesQueryKey, getGetSaleQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, DollarSign, Printer } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const STATUS_BADGE: Record<string, string> = {
  paid: "default", credit: "outline", partially_paid: "secondary", overdue: "destructive",
};

export default function SaleDetail({ id }: { id: string }) {
  const saleId = parseInt(id, 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [bankName, setBankName] = useState("");
  const [reference, setReference] = useState("");

  const { data: sale, isLoading } = useGetSale(saleId, { query: { enabled: !!saleId, queryKey: getGetSaleQueryKey(saleId) } });
  const createPayment = useCreatePayment();

  const handlePayment = () => {
    if (!amount || !paymentDate || !paymentMethod) { toast({ title: "Fill all fields", variant: "destructive" }); return; }
    createPayment.mutate({
      data: {
        saleId,
        amount: parseFloat(amount),
        paymentDate,
        paymentMethod,
        bankName: bankName || undefined,
        reference: reference || undefined,
      } as any,
    }, {
      onSuccess: () => {
        toast({ title: "Payment recorded" });
        setPaymentOpen(false);
        queryClient.invalidateQueries({ queryKey: getListSalesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetSaleQueryKey(saleId) });
      },
      onError: () => toast({ title: "Failed to record payment", variant: "destructive" }),
    });
  };

  if (isLoading) return <div className="p-8 space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  if (!sale) return <div className="p-8 text-muted-foreground">Invoice not found.</div>;

  const balanceDue = parseFloat(String(sale.balanceDue));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/sales")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{sale.invoiceNumber}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{sale.customerName ?? `Customer #${sale.customerId}`} · {sale.saleDate}</p>
        </div>
        <Badge variant={STATUS_BADGE[sale.status] as any}>{sale.status.replace(/_/g, " ").toUpperCase()}</Badge>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()} data-testid="button-print">
            <Printer className="h-4 w-4 mr-2" />Print
          </Button>
          {balanceDue > 0 && (
            <Button onClick={() => setPaymentOpen(true)} data-testid="button-record-payment">
              <DollarSign className="h-4 w-4 mr-2" />Record Payment
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Customer", value: sale.customerName ?? `Customer #${sale.customerId}` },
          { label: "Payment Type", value: sale.paymentType },
          { label: "Due Date", value: sale.dueDate ?? "—" },
          { label: "FS Number", value: sale.fsNumber ?? "—" },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-sm font-semibold mt-1 capitalize" data-testid={`text-${label.toLowerCase().replace(/\s+/g, "-")}`}>{value}</p>
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
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(sale.items ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No line items</TableCell></TableRow>
              ) : (sale.items ?? []).map((item: any, i: number) => (
                <TableRow key={i} data-testid={`row-item-${i}`}>
                  <TableCell>Product #{item.productId}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell>{item.unit}</TableCell>
                  <TableCell className="text-right">ETB {parseFloat(item.unitPrice).toLocaleString()}</TableCell>
                  <TableCell className="text-right">ETB {parseFloat(item.totalPrice).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="p-4 space-y-1 text-sm flex flex-col items-end">
            <Separator className="mb-3" />
            <div className="flex gap-8"><span className="text-muted-foreground">Subtotal</span><span className="w-36 text-right">ETB {parseFloat(String(sale.subtotal)).toLocaleString()}</span></div>
            {sale.vatApplicable && <div className="flex gap-8"><span className="text-muted-foreground">VAT (15%)</span><span className="w-36 text-right">ETB {parseFloat(String(sale.vatAmount)).toLocaleString()}</span></div>}
            <div className="flex gap-8 font-bold text-base"><span>Total</span><span className="w-36 text-right">ETB {parseFloat(String(sale.totalAmount)).toLocaleString()}</span></div>
            <div className="flex gap-8 text-green-600"><span>Paid</span><span className="w-36 text-right">ETB {parseFloat(String(sale.paidAmount)).toLocaleString()}</span></div>
            {balanceDue > 0 && <div className="flex gap-8 font-bold text-destructive"><span>Balance Due</span><span className="w-36 text-right">ETB {balanceDue.toLocaleString()}</span></div>}
          </div>
        </CardContent>
      </Card>

      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Amount (ETB) *</Label>
              <Input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder={`Max: ${balanceDue}`} data-testid="input-payment-amount" />
            </div>
            <div className="space-y-1.5">
              <Label>Payment Date *</Label>
              <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} data-testid="input-payment-date" />
            </div>
            <div className="space-y-1.5">
              <Label>Payment Method *</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger data-testid="select-payment-method"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(paymentMethod === "bank_transfer" || paymentMethod === "cheque") && (
              <div className="space-y-1.5">
                <Label>Bank Name</Label>
                <Input value={bankName} onChange={e => setBankName(e.target.value)} data-testid="input-bank-name" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Reference</Label>
              <Input value={reference} onChange={e => setReference(e.target.value)} data-testid="input-reference" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentOpen(false)}>Cancel</Button>
            <Button onClick={handlePayment} disabled={createPayment.isPending} data-testid="button-confirm-payment">
              {createPayment.isPending ? "Recording..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
