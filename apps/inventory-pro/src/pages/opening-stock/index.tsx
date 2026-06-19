import { useState } from "react";
import { useListOpeningStock, useCreateOpeningStock, useListStores, useListProducts, useListCategories } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PackagePlus, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { BATCH_UNITS } from "@/pages/production/new";

const STOCK_TYPES = [
  { value: "raw_material", label: "Raw Material" },
  { value: "semi_finished", label: "Semi-Finished" },
  { value: "finished_good", label: "Final / Packaged Product" },
];

const STOCK_TYPE_BADGE: Record<string, string> = {
  raw_material: "secondary",
  semi_finished: "outline",
  finished_good: "default",
};

const DEFAULT_FORM = {
  storeId: "",
  categoryId: "all",
  productId: "",
  itemName: "",
  quantity: "",
  unit: "KG",
  stockType: "raw_material",
  batchDetails: "",
  entryDate: new Date().toISOString().split("T")[0],
  notes: "",
};

export default function OpeningStockPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filterStoreId, setFilterStoreId] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...DEFAULT_FORM });

  const { data: stores } = useListStores();
  const { data: categories } = useListCategories();
  const { data: products } = useListProducts({ limit: 1000 });
  const { data, isLoading } = useListOpeningStock(
    filterStoreId !== "all" ? { storeId: parseInt(filterStoreId, 10) } : {},
  );
  const createEntry = useCreateOpeningStock();

  const filteredProducts = (products?.data ?? []).filter(p =>
    form.categoryId === "all" ? true : p.categoryId === parseInt(form.categoryId, 10)
  );

  const handleProductSelect = (productId: string) => {
    const selectedProd = (products?.data ?? []).find(p => String(p.id) === productId);
    setForm(f => ({
      ...f,
      productId,
      itemName: selectedProd ? selectedProd.name : "",
      unit: selectedProd ? selectedProd.unit : f.unit,
      stockType: selectedProd ? selectedProd.type : f.stockType,
    }));
  };

  const set = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = () => {
    if (!form.storeId || !form.itemName || !form.quantity || !form.unit || !form.entryDate) {
      toast({ title: "Fill all required fields", variant: "destructive" }); return;
    }
    createEntry.mutate({
      data: {
        storeId: parseInt(form.storeId, 10),
        productId: form.productId ? parseInt(form.productId, 10) : undefined,
        itemName: form.itemName.trim(),
        quantity: parseFloat(form.quantity),
        unit: form.unit,
        stockType: form.stockType as any,
        batchDetails: form.batchDetails || undefined,
        entryDate: form.entryDate,
        notes: form.notes || undefined,
      },
    }, {
      onSuccess: () => {
        toast({ title: "Opening stock registered", description: `${form.quantity} ${form.unit} of "${form.itemName}" added to inventory.` });
        queryClient.invalidateQueries({ queryKey: ["listOpeningStock"] });
        queryClient.invalidateQueries({ queryKey: ["listInventory"] });
        setOpen(false);
        setForm({ ...DEFAULT_FORM });
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.error ?? "Failed to register opening stock";
        toast({ title: "Error", description: msg, variant: "destructive" });
      },
    });
  };

  const storeName = (id: number) => (stores ?? []).find(s => s.id === id)?.name ?? `Store #${id}`;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Opening Stock</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Register existing stock before normal operations begin</p>
        </div>
        <Button onClick={() => setOpen(true)} data-testid="button-add-opening-stock">
          <Plus className="h-4 w-4 mr-2" />Register Stock
        </Button>
      </div>

      {/* Filter */}
      <div className="flex gap-3">
        <Select value={filterStoreId} onValueChange={v => setFilterStoreId(v)}>
          <SelectTrigger className="w-52"><SelectValue placeholder="All stores" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stores</SelectItem>
            {(stores ?? []).map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {["raw_material", "semi_finished", "finished_good"].map(type => {
          const count = (data?.data ?? []).filter((r: any) => r.stockType === type).length;
          const typeLabel = STOCK_TYPES.find(t => t.value === type)?.label ?? type;
          return (
            <Card key={type}>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">{typeLabel}</p>
                <p className="text-2xl font-bold mt-1">{count}</p>
                <p className="text-xs text-muted-foreground mt-0.5">item{count !== 1 ? "s" : ""} registered</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Item Name</TableHead>
                  <TableHead>Stock Type</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>Batch / Package</TableHead>
                  <TableHead>Entry Date</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-14 text-muted-foreground">
                      <PackagePlus className="mx-auto h-8 w-8 mb-2 opacity-30" />
                      No opening stock registered yet
                    </TableCell>
                  </TableRow>
                ) : (data?.data ?? []).map((row: any) => (
                  <TableRow key={row.id} data-testid={`row-os-${row.id}`}>
                    <TableCell className="text-muted-foreground text-sm">{row.id}</TableCell>
                    <TableCell className="font-medium">{storeName(row.storeId)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {(categories ?? []).find((c: any) => String(c.id) === String((products?.data ?? []).find((p: any) => String(p.id) === String(row.productId))?.categoryId))?.name ?? "—"}
                    </TableCell>
                    <TableCell className="font-semibold">{row.itemName}</TableCell>
                    <TableCell>
                      <Badge variant={STOCK_TYPE_BADGE[row.stockType] as any}>
                        {STOCK_TYPES.find(t => t.value === row.stockType)?.label ?? row.stockType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {parseFloat(row.quantity).toLocaleString()} <span className="text-muted-foreground text-xs">{row.unit}</span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.batchDetails || "—"}</TableCell>
                    <TableCell className="text-sm">{row.entryDate}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">{row.notes || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Register Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Register Opening Stock</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Store */}
            <div className="space-y-1.5">
              <Label>Store *</Label>
              <Select value={form.storeId} onValueChange={v => set("storeId", v)}>
                <SelectTrigger data-testid="select-store"><SelectValue placeholder="Select store" /></SelectTrigger>
                <SelectContent>{(stores ?? []).map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {/* Category Filter */}
            <div className="space-y-1.5">
              <Label>Filter by Category</Label>
              <Select value={form.categoryId} onValueChange={v => set("categoryId", v)}>
                <SelectTrigger><SelectValue placeholder="All Categories" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {(categories ?? []).map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.code ? `[${c.code}] ${c.name}` : c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Product / Item */}
            <div className="space-y-1.5">
              <Label>Product *</Label>
              <Select value={form.productId} onValueChange={handleProductSelect}>
                <SelectTrigger data-testid="select-product"><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>
                  {filteredProducts.map(p => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Stock type */}
            <div className="space-y-1.5">
              <Label>Stock Type *</Label>
              <Select value={form.stockType} onValueChange={v => set("stockType", v)}>
                <SelectTrigger data-testid="select-stock-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STOCK_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Quantity + unit */}
            <div className="space-y-1.5">
              <Label>Quantity & Unit *</Label>
              <div className="flex gap-2">
                <Input
                  type="number" min="0.001" step="0.001"
                  value={form.quantity}
                  onChange={e => set("quantity", e.target.value)}
                  placeholder="0.000"
                  className="flex-1"
                  data-testid="input-quantity"
                />
                <Select value={form.unit} onValueChange={v => set("unit", v)}>
                  <SelectTrigger className="w-28" data-testid="select-unit"><SelectValue /></SelectTrigger>
                  <SelectContent>{BATCH_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {/* Entry date */}
            <div className="space-y-1.5">
              <Label>Entry Date *</Label>
              <Input type="date" value={form.entryDate} onChange={e => set("entryDate", e.target.value)} data-testid="input-entry-date" />
            </div>

            {/* Batch / package details */}
            <div className="space-y-1.5">
              <Label>Batch / Package Details <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                value={form.batchDetails}
                onChange={e => set("batchDetails", e.target.value)}
                placeholder="e.g. Batch #001, 250g bottles, imported lot"
                data-testid="input-batch-details"
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} data-testid="textarea-notes" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createEntry.isPending} data-testid="button-submit">
              {createEntry.isPending ? "Saving…" : "Register Stock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
