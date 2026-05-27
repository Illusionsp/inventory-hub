import { useState } from "react";
import { useListStores, useListProducts, useCreateTransfer, getListTransfersQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TransferItem { productId: string; requestedQty: string; }

export default function TransferNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [fromStoreId, setFromStoreId] = useState("");
  const [toStoreId, setToStoreId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<TransferItem[]>([{ productId: "", requestedQty: "" }]);

  const { data: stores } = useListStores();
  const { data: productsData } = useListProducts({ limit: 200 });
  const createTransfer = useCreateTransfer();

  const addItem = () => setItems(prev => [...prev, { productId: "", requestedQty: "" }]);
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof TransferItem, value: string) =>
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromStoreId || !toStoreId) { toast({ title: "Select both stores", variant: "destructive" }); return; }
    if (fromStoreId === toStoreId) { toast({ title: "Source and destination must differ", variant: "destructive" }); return; }

    createTransfer.mutate({
      data: {
        fromStoreId: parseInt(fromStoreId, 10),
        toStoreId: parseInt(toStoreId, 10),
        notes: notes || undefined,
        items: items.filter(i => i.productId && i.requestedQty).map(i => ({
          productId: parseInt(i.productId, 10),
          requestedQty: parseFloat(i.requestedQty),
        })),
      } as any,
    }, {
      onSuccess: (res: any) => {
        toast({ title: "Transfer request created" });
        queryClient.invalidateQueries({ queryKey: getListTransfersQueryKey() });
        setLocation(`/transfers/${res.id}`);
      },
      onError: () => toast({ title: "Failed to create transfer", variant: "destructive" }),
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/transfers")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Transfer Request</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Request stock movement between stores</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Transfer Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>From Store *</Label>
              <Select value={fromStoreId} onValueChange={setFromStoreId}>
                <SelectTrigger data-testid="select-from-store"><SelectValue placeholder="Select source store" /></SelectTrigger>
                <SelectContent>{(stores ?? []).map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>To Store *</Label>
              <Select value={toStoreId} onValueChange={setToStoreId}>
                <SelectTrigger data-testid="select-to-store"><SelectValue placeholder="Select destination store" /></SelectTrigger>
                <SelectContent>{(stores ?? []).filter(s => String(s.id) !== fromStoreId).map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} data-testid="textarea-notes" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Items to Transfer</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addItem} data-testid="button-add-item">
              <Plus className="h-3.5 w-3.5 mr-1" />Add Item
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-[1fr_160px_40px] gap-3 items-end">
                <div className="space-y-1.5">
                  {i === 0 && <Label>Product</Label>}
                  <Select value={item.productId} onValueChange={v => updateItem(i, "productId", v)}>
                    <SelectTrigger data-testid={`select-product-${i}`}><SelectValue placeholder="Select product" /></SelectTrigger>
                    <SelectContent>
                      {(productsData?.data ?? []).map((p: any) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.name} ({p.sku})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  {i === 0 && <Label>Requested Qty</Label>}
                  <Input type="number" min="0.001" step="0.001" value={item.requestedQty} onChange={e => updateItem(i, "requestedQty", e.target.value)} placeholder="0.000" data-testid={`input-qty-${i}`} />
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(i)} disabled={items.length === 1} data-testid={`button-remove-item-${i}`}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => setLocation("/transfers")} data-testid="button-cancel">Cancel</Button>
          <Button type="submit" disabled={createTransfer.isPending} data-testid="button-submit">
            {createTransfer.isPending ? "Creating..." : "Create Transfer"}
          </Button>
        </div>
      </form>
    </div>
  );
}
