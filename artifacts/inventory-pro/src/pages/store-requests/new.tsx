import { useState } from "react";
import { useListStores, useListProducts, useCreateStoreRequest, getListStoreRequestsQueryKey } from "@workspace/api-client-react";
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
import { useAuth } from "@/lib/auth";

const UNITS = ["pcs", "kg", "g", "liters", "ml", "boxes", "bags", "cartons", "pallets", "rolls", "meters", "pairs"];

interface RequestItem { productId: string; quantity: string; unit: string; }

export default function StoreRequestNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [requestingStoreId, setRequestingStoreId] = useState(
    user?.storeId ? String(user.storeId) : ""
  );
  const [receivingStoreId, setReceivingStoreId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<RequestItem[]>([{ productId: "", quantity: "", unit: "pcs" }]);

  const { data: stores } = useListStores();
  const { data: productsData } = useListProducts({ limit: 200 });
  const createRequest = useCreateStoreRequest();

  const addItem = () => setItems(prev => [...prev, { productId: "", quantity: "", unit: "pcs" }]);
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof RequestItem, value: string) =>
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestingStoreId || !receivingStoreId) {
      toast({ title: "Select both stores", variant: "destructive" });
      return;
    }
    if (requestingStoreId === receivingStoreId) {
      toast({ title: "Requesting and receiving stores must differ", variant: "destructive" });
      return;
    }
    const validItems = items.filter(i => i.productId && i.quantity && parseFloat(i.quantity) > 0);
    if (!validItems.length) {
      toast({ title: "Add at least one item with a quantity", variant: "destructive" });
      return;
    }

    createRequest.mutate(
      {
        data: {
          requestingStoreId: parseInt(requestingStoreId, 10),
          receivingStoreId: parseInt(receivingStoreId, 10),
          notes: notes || undefined,
          items: validItems.map(i => ({
            productId: parseInt(i.productId, 10),
            quantity: parseFloat(i.quantity),
            unit: i.unit || undefined,
          })),
        },
      },
      {
        onSuccess: (res: any) => {
          toast({ title: "Store request created" });
          queryClient.invalidateQueries({ queryKey: getListStoreRequestsQueryKey() });
          setLocation(`/store-requests/${res.id}`);
        },
        onError: () => toast({ title: "Failed to create request", variant: "destructive" }),
      },
    );
  };

  const isStoreManager = user?.role === "store_manager";

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/store-requests")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Store Request</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Request items from another store</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Request Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Requesting Store *</Label>
              <Select
                value={requestingStoreId}
                onValueChange={setRequestingStoreId}
                disabled={isStoreManager}
              >
                <SelectTrigger data-testid="select-requesting-store">
                  <SelectValue placeholder="Select your store" />
                </SelectTrigger>
                <SelectContent>
                  {(stores ?? []).map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Receiving Store *</Label>
              <Select value={receivingStoreId} onValueChange={setReceivingStoreId}>
                <SelectTrigger data-testid="select-receiving-store">
                  <SelectValue placeholder="Select store to request from" />
                </SelectTrigger>
                <SelectContent>
                  {(stores ?? [])
                    .filter(s => String(s.id) !== requestingStoreId)
                    .map(s => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="Optional notes about this request..."
                data-testid="textarea-notes"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Items Requested</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addItem} data-testid="button-add-item">
              <Plus className="h-3.5 w-3.5 mr-1" />Add Item
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-[1fr_120px_120px_40px] gap-3 items-end">
                <div className="space-y-1.5">
                  {i === 0 && <Label>Product</Label>}
                  <Select value={item.productId} onValueChange={v => updateItem(i, "productId", v)}>
                    <SelectTrigger data-testid={`select-product-${i}`}>
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      {(productsData?.data ?? []).map((p: any) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name} ({p.sku})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  {i === 0 && <Label>Quantity</Label>}
                  <Input
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={item.quantity}
                    onChange={e => updateItem(i, "quantity", e.target.value)}
                    placeholder="0.000"
                    data-testid={`input-qty-${i}`}
                  />
                </div>
                <div className="space-y-1.5">
                  {i === 0 && <Label>Unit</Label>}
                  <Select value={item.unit} onValueChange={v => updateItem(i, "unit", v)}>
                    <SelectTrigger data-testid={`select-unit-${i}`}>
                      <SelectValue placeholder="Unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeItem(i)}
                  disabled={items.length === 1}
                  data-testid={`button-remove-item-${i}`}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setLocation("/store-requests")}
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button type="submit" disabled={createRequest.isPending} data-testid="button-submit">
            {createRequest.isPending ? "Creating..." : "Submit Request"}
          </Button>
        </div>
      </form>
    </div>
  );
}
