import { useState } from "react";
import { useListCustomers, useListProducts, useListStores, useCreateSale, getListSalesQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SaleItem { productId: string; quantity: string; unit: string; unitPrice: string; discount: string; }

export default function SalesNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [customerId, setCustomerId] = useState("");
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentType, setPaymentType] = useState("cash");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [bankName, setBankName] = useState("");
  const [vatApplicable, setVatApplicable] = useState(false);
  const [withholdApplicable, setWithholdApplicable] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [storeId, setStoreId] = useState("");
  const [fsNumber, setFsNumber] = useState("");
  const [remarks, setRemarks] = useState("");
  const [items, setItems] = useState<SaleItem[]>([{ productId: "", quantity: "", unit: "PCS", unitPrice: "", discount: "0" }]);

  const { data: customersData } = useListCustomers({});
  const { data: productsData } = useListProducts({ limit: 200 });
  const { data: stores } = useListStores();
  const createSale = useCreateSale();

  const addItem = () => setItems(prev => [...prev, { productId: "", quantity: "", unit: "PCS", unitPrice: "", discount: "0" }]);
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof SaleItem, value: string) =>
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));

  const subtotal = items.reduce((sum, item) => {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unitPrice) || 0;
    const disc = parseFloat(item.discount) || 0;
    return sum + (qty * price - disc);
  }, 0);

  const vatAmount = vatApplicable ? subtotal * 0.15 : 0;
  const withholdAmount = withholdApplicable ? subtotal * 0.03 : 0;
  const totalAmount = subtotal + vatAmount;
  const netPayable = totalAmount - withholdAmount;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !saleDate || !paymentType || !storeId || items.length === 0) {
      toast({ title: "Please fill all required fields, including dispatch store", variant: "destructive" });
      return;
    }
    if (paymentType === "credit" && !dueDate) {
      toast({ title: "Due Date is required for credit sales", variant: "destructive" });
      return;
    }

    createSale.mutate({
      data: {
        customerId: parseInt(customerId, 10),
        saleDate,
        fsNumber: fsNumber || undefined,
        paymentType,
        paymentMethod: paymentType === "cash" ? paymentMethod : undefined,
        bankName: (paymentMethod === "bank_transfer" || paymentMethod === "cheque") ? bankName : undefined,
        vatApplicable,
        dueDate: paymentType === "credit" ? dueDate || undefined : undefined,
        storeId: storeId && storeId !== "none" ? parseInt(storeId, 10) : undefined,
        remarks: remarks || undefined,
        items: items.filter(i => i.productId && i.quantity && i.unitPrice).map(i => {
          const qty = parseFloat(i.quantity);
          const price = parseFloat(i.unitPrice);
          const disc = parseFloat(i.discount) || 0;
          return { productId: parseInt(i.productId, 10), quantity: qty, unit: i.unit, unitPrice: price, discount: disc, totalPrice: qty * price - disc };
        }),
      } as any,
    }, {
      onSuccess: (res: any) => {
        toast({ title: "Invoice created" });
        queryClient.invalidateQueries({ queryKey: getListSalesQueryKey() });
        queryClient.invalidateQueries({ queryKey: ["salesReport"] });
        setLocation(`/sales/${res.id}`);
      },
      onError: () => toast({ title: "Failed to create invoice", variant: "destructive" }),
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/sales")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Sales Invoice</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Create a new sales invoice</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Invoice Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Customer *</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>{(customersData?.data ?? []).map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
              {customerId && (
                <p className="text-xs text-muted-foreground mt-1">
                  TIN: {(customersData?.data ?? []).find((c: any) => String(c.id) === customerId)?.taxNumber || "Not provided (Update in Customers tab)"}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Sale Date *</Label>
              <Input type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>FS Number</Label>
              <Input value={fsNumber} onChange={e => setFsNumber(e.target.value)} placeholder="Fiscal number" />
            </div>
            <div className="space-y-1.5">
              <Label>Payment Type *</Label>
              <Select value={paymentType} onValueChange={setPaymentType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="credit">Credit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {paymentType === "cash" && (
              <div className="space-y-1.5">
                <Label>Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {paymentType === "credit" && (
              <div className="space-y-1.5">
                <Label>Due Date *</Label>
                <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </div>
            )}
            {(paymentMethod === "bank_transfer" || paymentMethod === "cheque") && (
              <div className="space-y-1.5">
                <Label>Bank Name</Label>
                <Input value={bankName} onChange={e => setBankName(e.target.value)} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Dispatch Store</Label>
              <Select value={storeId} onValueChange={setStoreId}>
                <SelectTrigger><SelectValue placeholder="Select store" /></SelectTrigger>
                <SelectContent>
                  {(stores ?? []).map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 mt-6">
              <Checkbox id="vat" checked={vatApplicable} onCheckedChange={v => setVatApplicable(!!v)} />
              <Label htmlFor="vat">Apply VAT (15%)</Label>
            </div>
            <div className="flex items-center gap-2 mt-6">
              <Checkbox id="withhold" checked={withholdApplicable} onCheckedChange={v => setWithholdApplicable(!!v)} />
              <Label htmlFor="withhold">Apply Withhold (3%)</Label>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Remarks</Label>
              <Textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={2} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Line Items</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Item
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-[2fr_100px_80px_130px_120px_40px] gap-2 items-end">
                <div className="space-y-1.5">
                  {i === 0 && <Label>Product</Label>}
                  <Select value={item.productId} onValueChange={v => {
                    const product = (productsData?.data ?? []).find((p: any) => String(p.id) === v);
                    updateItem(i, "productId", v);
                    if (product?.unitCost) updateItem(i, "unitPrice", String(parseFloat(String(product.unitCost))));
                    if (product?.unit) updateItem(i, "unit", product.unit);
                  }}>
                    <SelectTrigger><SelectValue placeholder="Product" /></SelectTrigger>
                    <SelectContent>{(productsData?.data ?? []).map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  {i === 0 && <Label>Qty</Label>}
                  <Input type="number" min="0.001" step="0.001" value={item.quantity} onChange={e => updateItem(i, "quantity", e.target.value)} placeholder="0" />
                </div>
                <div className="space-y-1.5">
                  {i === 0 && <Label>Unit</Label>}
                  <Input value={item.unit} onChange={e => updateItem(i, "unit", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  {i === 0 && <Label>Unit Price (ETB)</Label>}
                  <Input type="number" min="0" step="0.01" value={item.unitPrice} onChange={e => updateItem(i, "unitPrice", e.target.value)} placeholder="0.00" />
                </div>
                <div className="space-y-1.5">
                  {i === 0 && <Label>Line Total</Label>}
                  <Input
                    readOnly
                    value={`ETB ${((parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0) - (parseFloat(item.discount) || 0)).toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
                    className="bg-muted text-right"
                  />
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(i)} disabled={items.length === 1}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}

            <Separator className="mt-4" />
            <div className="flex flex-col items-end gap-1.5 text-sm">
              <div className="flex gap-8">
                <span className="text-muted-foreground">Subtotal (B4 VAT)</span>
                <span className="font-medium w-36 text-right">ETB {subtotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </div>
              {vatApplicable && (
                <div className="flex gap-8">
                  <span className="text-muted-foreground">VAT (15%)</span>
                  <span className="font-medium w-36 text-right">ETB {vatAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex gap-8">
                <span className="font-semibold">Total Amount</span>
                <span className="font-semibold w-36 text-right">ETB {totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </div>
              {withholdApplicable && (
                <div className="flex gap-8 text-amber-700 dark:text-amber-400">
                  <span className="font-medium">Withhold Deduction (3%)</span>
                  <span className="font-medium w-36 text-right">− ETB {withholdAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <Separator className="w-full my-1" />
              <div className="flex gap-8 text-base font-bold">
                <span>Net Payable</span>
                <span className="w-36 text-right">ETB {netPayable.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => setLocation("/sales")}>Cancel</Button>
          <Button type="submit" disabled={createSale.isPending}>
            {createSale.isPending ? "Creating..." : "Create Invoice"}
          </Button>
        </div>
      </form>
    </div>
  );
}
