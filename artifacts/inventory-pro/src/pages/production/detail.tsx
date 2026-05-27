import { useState, useEffect } from "react";
import { useGetProductionBatch, useCompleteProductionBatch, useDispatchProductionBatch, getListProductionBatchesQueryKey, useListProducts, useListStores } from "@workspace/api-client-react";
import { BATCH_UNITS } from "./new";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, CheckCircle, Package, Plus, SendHorizonal, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface OutputProduct { productId: string; quantity: string; unit: string; }

const PACKAGE_TYPES = ["bottle", "sachet", "bag", "carton", "pouch", "can", "jar", "box", "tube", "packet"];
const SIZE_UNITS = ["g", "kg", "ml", "L", "mg", "pcs"];

// Convert fromUnit qty to toUnit (g↔kg, ml↔L)
function convertUnit(qty: number, from: string, to: string): number {
  const f = from.toLowerCase();
  const t = to.toLowerCase();
  if (f === t) return qty;
  if (f === "g" && t === "kg") return qty / 1000;
  if (f === "kg" && t === "g") return qty * 1000;
  if (f === "ml" && t === "l") return qty / 1000;
  if (f === "l" && t === "ml") return qty * 1000;
  if (f === "mg" && t === "g") return qty / 1000;
  if (f === "g" && t === "mg") return qty * 1000;
  return qty;
}

export default function ProductionDetail({ id }: { id: string }) {
  const batchId = parseInt(id, 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ── Complete-batch form state ──────────────────────────────────────────────
  const [actualOutputQty, setActualOutputQty] = useState("");
  const [wastageQty, setWastageQty] = useState("");
  const [outputs, setOutputs] = useState<OutputProduct[]>([{ productId: "", quantity: "", unit: "KG" }]);

  // ── Packaging state ────────────────────────────────────────────────────────
  const [enablePackaging, setEnablePackaging] = useState(false);
  const [finalProductName, setFinalProductName] = useState("");
  const [packageType, setPackageType] = useState("bottle");
  const [packageSize, setPackageSize] = useState("");
  const [packageSizeUnit, setPackageSizeUnit] = useState("g");
  const [packagesProduced, setPackagesProduced] = useState("");

  // ── Dispatch state ─────────────────────────────────────────────────────────
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [dispatchStoreId, setDispatchStoreId] = useState("");

  const { data: batch, isLoading } = useGetProductionBatch(batchId, { query: { enabled: !!batchId, queryKey: ['getProductionBatch', batchId] } });
  const { data: productsData } = useListProducts({ limit: 200 });
  const { data: storesData } = useListStores();
  const completeBatch = useCompleteProductionBatch();
  const dispatchBatch = useDispatchProductionBatch();

  // Auto-calculate packages produced whenever actual output or packaging config changes
  useEffect(() => {
    if (!enablePackaging) return;
    const actual = parseFloat(actualOutputQty);
    const pkgSz = parseFloat(packageSize);
    if (!actual || !pkgSz || !packageSizeUnit) return;

    // Derive bulk unit from first output row (or default kg)
    const bulkUnit = outputs[0]?.unit || "KG";
    const totalInPkgUnit = convertUnit(actual, bulkUnit, packageSizeUnit);
    const calculated = Math.floor(totalInPkgUnit / pkgSz);
    if (calculated > 0) setPackagesProduced(String(calculated));
  }, [actualOutputQty, packageSize, packageSizeUnit, enablePackaging, outputs]);

  const addOutput = () => setOutputs(prev => [...prev, { productId: "", quantity: "", unit: "KG" }]);
  const removeOutput = (i: number) => setOutputs(prev => prev.filter((_, idx) => idx !== i));
  const updateOutput = (i: number, field: keyof OutputProduct, value: string) =>
    setOutputs(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));

  const handleDispatch = () => {
    if (!dispatchStoreId) { toast({ title: "Select a destination store", variant: "destructive" }); return; }
    dispatchBatch.mutate({ id: batchId, data: { targetStoreId: parseInt(dispatchStoreId, 10) } }, {
      onSuccess: () => {
        toast({ title: "Products dispatched", description: "Stock has been transferred to the selected store." });
        queryClient.invalidateQueries({ queryKey: ['getProductionBatch', batchId] });
        queryClient.invalidateQueries({ queryKey: getListProductionBatchesQueryKey() });
        queryClient.invalidateQueries({ queryKey: ["listInventory"] });
        setDispatchOpen(false);
        setDispatchStoreId("");
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.error ?? "Failed to dispatch";
        toast({ title: "Error", description: msg, variant: "destructive" });
      },
    });
  };

  const handleComplete = () => {
    if (!actualOutputQty || !wastageQty) {
      toast({ title: "Enter actual output and wastage", variant: "destructive" }); return;
    }
    if (enablePackaging && (!finalProductName || !packageType || !packageSize || !packageSizeUnit || !packagesProduced)) {
      toast({ title: "Fill all packaging fields", variant: "destructive" }); return;
    }

    completeBatch.mutate({
      id: batchId,
      data: {
        actualOutputQty: parseFloat(actualOutputQty),
        wastageQty: parseFloat(wastageQty),
        outputProducts: outputs.filter(o => o.productId && o.quantity).map(o => ({
          productId: parseInt(o.productId, 10), quantity: parseFloat(o.quantity), unit: o.unit,
        })),
        ...(enablePackaging ? {
          finalProductName,
          packageType,
          packageSize: parseFloat(packageSize),
          packageSizeUnit,
          packagesProduced: parseFloat(packagesProduced),
        } : {}),
      } as any,
    }, {
      onSuccess: () => {
        toast({ title: "Production batch completed" });
        queryClient.invalidateQueries({ queryKey: getListProductionBatchesQueryKey() });
      },
      onError: () => toast({ title: "Failed to complete batch", variant: "destructive" }),
    });
  };

  if (isLoading) return <div className="p-8 space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  if (!batch) return <div className="p-8 text-muted-foreground">Batch not found.</div>;

  const planned = parseFloat(String(batch.plannedOutputQty));
  const actual = actualOutputQty ? parseFloat(actualOutputQty) : batch.actualOutputQty ? parseFloat(String(batch.actualOutputQty)) : null;
  const wastage = wastageQty ? parseFloat(wastageQty) : batch.wastageQty ? parseFloat(String(batch.wastageQty)) : null;
  const yieldPct = actual && planned ? ((actual / planned) * 100).toFixed(1) : null;
  const wastagePct = wastage && planned ? ((wastage / planned) * 100).toFixed(1) : null;

  // Packaging summary for completed batches
  const hasPackagingInfo = batch.packagesProduced && batch.packageSize;
  const pkgLabel = hasPackagingInfo
    ? `${batch.finalProductName} — ${batch.packageSize}${batch.packageSizeUnit} ${batch.packageType}`
    : null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/production")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{batch.batchNumber}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{batch.type === "raw_to_semi" ? "Raw Material → Semi-Finished" : "Semi-Finished → Finished"}</p>
        </div>
        <Badge variant={batch.status === "completed" ? "default" : batch.status === "cancelled" ? "destructive" : "outline"}>
          {batch.status.replace(/_/g, " ").toUpperCase()}
        </Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Planned Output", value: planned, unit: batch.outputUnit },
          { label: "Actual Output", value: actual ?? "—", unit: actual ? batch.outputUnit : undefined },
          { label: "Wastage", value: wastage ?? "—", unit: wastage ? batch.outputUnit : undefined },
          { label: "Yield %", value: yieldPct ? `${yieldPct}%` : "—" },
          { label: "Wastage %", value: wastagePct ? `${wastagePct}%` : "—" },
        ].map(({ label, value, unit }: { label: string; value: string | number; unit?: string }) => (
          <Card key={label}>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-lg font-bold mt-1" data-testid={`text-${label.toLowerCase().replace(/\s+/g, "-")}`}>
                {value}{unit ? <span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span> : null}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Packaging summary (completed batches) */}
      {batch.status === "completed" && hasPackagingInfo && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 py-3">
            <Package className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Packaging</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-0">
            {[
              { label: "Final Product", value: batch.finalProductName ?? "—" },
              { label: "Package", value: pkgLabel ?? "—" },
              { label: "Packages Produced", value: parseFloat(String(batch.packagesProduced)).toLocaleString() + " pcs" },
              { label: "Total Packaged", value: (() => {
                const total = parseFloat(String(batch.packagesProduced)) * parseFloat(String(batch.packageSize));
                return `${total.toLocaleString()} ${batch.packageSizeUnit}`;
              })() },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="font-semibold mt-0.5">{value}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Input Materials</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="text-right">Qty</TableHead><TableHead>Unit</TableHead></TableRow></TableHeader>
            <TableBody>
              {(batch.inputMaterials ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">No input materials recorded</TableCell></TableRow>
              ) : (batch.inputMaterials ?? []).map((m: any, i: number) => (
                <TableRow key={i} data-testid={`row-input-${i}`}>
                  <TableCell>{(productsData?.data ?? []).find((p: any) => p.id === m.productId)?.name ?? `Product #${m.productId}`}</TableCell>
                  <TableCell className="text-right">{m.quantity}</TableCell>
                  <TableCell>{m.unit}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {batch.status === "in_progress" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Complete Batch</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            {/* Output quantities */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Actual Output Qty *</Label>
                <div className="flex gap-2 items-center">
                  <Input type="number" min="0" step="0.001" value={actualOutputQty} onChange={e => setActualOutputQty(e.target.value)} placeholder="0.000" data-testid="input-actual-qty" className="flex-1" />
                  <span className="text-sm font-medium text-muted-foreground bg-muted px-3 py-2 rounded-md border border-input min-w-[56px] text-center">{batch.outputUnit}</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Wastage Qty *</Label>
                <div className="flex gap-2 items-center">
                  <Input type="number" min="0" step="0.001" value={wastageQty} onChange={e => setWastageQty(e.target.value)} placeholder="0.000" data-testid="input-wastage-qty" className="flex-1" />
                  <span className="text-sm font-medium text-muted-foreground bg-muted px-3 py-2 rounded-md border border-input min-w-[56px] text-center">{batch.outputUnit}</span>
                </div>
              </div>
            </div>

            {/* Output products */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label>Output Products (Bulk)</Label>
                <Button type="button" variant="outline" size="sm" onClick={addOutput} data-testid="button-add-output">
                  <Plus className="h-3.5 w-3.5 mr-1" />Add
                </Button>
              </div>
              {outputs.map((out, i) => (
                <div key={i} className="grid grid-cols-[1fr_130px_110px_40px] gap-3 items-end mb-3">
                  <Select value={out.productId} onValueChange={v => updateOutput(i, "productId", v)}>
                    <SelectTrigger data-testid={`select-output-product-${i}`}><SelectValue placeholder="Product" /></SelectTrigger>
                    <SelectContent>{(productsData?.data ?? []).map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input type="number" min="0.001" step="0.001" value={out.quantity} onChange={e => updateOutput(i, "quantity", e.target.value)} placeholder="0.000" data-testid={`input-output-qty-${i}`} />
                  <Select value={out.unit} onValueChange={v => updateOutput(i, "unit", v)}>
                    <SelectTrigger data-testid={`input-output-unit-${i}`}><SelectValue /></SelectTrigger>
                    <SelectContent>{BATCH_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeOutput(i)} disabled={outputs.length === 1}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

            <Separator />

            {/* Packaging toggle */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="enable-packaging"
                checked={enablePackaging}
                onChange={e => setEnablePackaging(e.target.checked)}
                className="h-4 w-4 accent-primary cursor-pointer"
                data-testid="checkbox-packaging"
              />
              <label htmlFor="enable-packaging" className="flex items-center gap-2 font-medium cursor-pointer select-none">
                <Package className="h-4 w-4 text-primary" />
                Package into final product units
              </label>
            </div>

            {enablePackaging && (
              <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                <p className="text-sm text-muted-foreground">
                  Bulk output will be converted into packaged units. Stock updates automatically.
                </p>

                {/* Final product name + package type */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Final Product Name *</Label>
                    <Input
                      value={finalProductName}
                      onChange={e => setFinalProductName(e.target.value)}
                      placeholder="e.g. Refined Honey"
                      data-testid="input-final-product-name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Package Type *</Label>
                    <Select value={packageType} onValueChange={setPackageType} data-testid="select-package-type">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PACKAGE_TYPES.map(t => (
                          <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Package size + unit */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label>Package Size *</Label>
                    <Input
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={packageSize}
                      onChange={e => setPackageSize(e.target.value)}
                      placeholder="e.g. 100"
                      data-testid="input-package-size"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Size Unit *</Label>
                    <Select value={packageSizeUnit} onValueChange={setPackageSizeUnit}>
                      <SelectTrigger data-testid="select-size-unit"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SIZE_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Packages Produced *</Label>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={packagesProduced}
                      onChange={e => setPackagesProduced(e.target.value)}
                      placeholder="Auto-calculated"
                      data-testid="input-packages-produced"
                    />
                  </div>
                </div>

                {/* Live preview */}
                {finalProductName && packageSize && packagesProduced && (
                  <div className="rounded-md bg-primary/10 border border-primary/20 p-3 text-sm space-y-1">
                    <p className="font-medium text-primary">Stock conversion preview</p>
                    <p>
                      <span className="font-semibold">{packagesProduced} × {packageSize}{packageSizeUnit} {packageType}</span>
                      {" "}of <span className="font-semibold">{finalProductName}</span>
                    </p>
                    <p className="text-muted-foreground">
                      ↳ Product registered as: <span className="font-mono text-xs">{finalProductName} {packageSize}{packageSizeUnit} {packageType}</span>
                    </p>
                    <p className="text-muted-foreground">
                      ↳ Bulk consumed: {(parseFloat(packagesProduced || "0") * parseFloat(packageSize || "0")).toLocaleString()} {packageSizeUnit}
                    </p>
                  </div>
                )}
              </div>
            )}

            <Button onClick={handleComplete} disabled={completeBatch.isPending} className="w-full" data-testid="button-complete">
              <CheckCircle className="h-4 w-4 mr-2" />
              {completeBatch.isPending ? "Completing..." : "Complete Batch"}
            </Button>
          </CardContent>
        </Card>
      )}

      {(batch.outputProducts ?? []).length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Output Products</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="text-right">Qty</TableHead><TableHead>Unit</TableHead></TableRow></TableHeader>
              <TableBody>
                {(batch.outputProducts ?? []).map((o: any, i: number) => (
                  <TableRow key={i} data-testid={`row-output-${i}`}>
                    <TableCell>{(productsData?.data ?? []).find((p: any) => p.id === o.productId)?.name ?? `Product #${o.productId}`}</TableCell>
                    <TableCell className="text-right">{o.quantity}</TableCell>
                    <TableCell>{o.unit}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ── Dispatch card ── shown when completed and not yet dispatched ─────── */}
      {batch.status === "completed" && !batch.dispatchedAt && (
        <Card className="border-blue-200 bg-blue-50/40 dark:bg-blue-950/20">
          <CardContent className="flex items-center justify-between py-4 px-5">
            <div>
              <p className="font-semibold text-sm">Ready to Dispatch</p>
              <p className="text-muted-foreground text-xs mt-0.5">
                Send all finished products from this batch to the final product store.
              </p>
            </div>
            <Button onClick={() => setDispatchOpen(true)} data-testid="button-dispatch">
              <SendHorizonal className="h-4 w-4 mr-2" />Dispatch to Store
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Dispatched info ── */}
      {batch.status === "completed" && batch.dispatchedAt && (
        <Card className="border-green-200 bg-green-50/40 dark:bg-green-950/20">
          <CardContent className="flex items-center gap-3 py-4 px-5">
            <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
            <div>
              <p className="font-semibold text-sm text-green-800 dark:text-green-300">Dispatched</p>
              <p className="text-muted-foreground text-xs mt-0.5">
                Products sent to{" "}
                <span className="font-medium">
                  {(storesData ?? []).find((s: any) => s.id === batch.dispatchedToStoreId)?.name ?? `Store #${batch.dispatchedToStoreId}`}
                </span>
                {" "}on {new Date(batch.dispatchedAt).toLocaleDateString()}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Dispatch dialog ─────────────────────────────────────────────────── */}
      <Dialog open={dispatchOpen} onOpenChange={setDispatchOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Dispatch Finished Products</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              All finished products credited to this batch will be moved to the selected store's inventory.
            </p>
            <div className="space-y-1.5">
              <Label>Destination Store *</Label>
              <Select value={dispatchStoreId} onValueChange={setDispatchStoreId}>
                <SelectTrigger data-testid="select-dispatch-store">
                  <SelectValue placeholder="Select store" />
                </SelectTrigger>
                <SelectContent>
                  {(storesData ?? [])
                    .filter((s: any) => s.id !== (batch as any).stageToStoreId)
                    .map((s: any) => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDispatchOpen(false)}>Cancel</Button>
            <Button onClick={handleDispatch} disabled={dispatchBatch.isPending} data-testid="button-confirm-dispatch">
              <SendHorizonal className="h-4 w-4 mr-2" />
              {dispatchBatch.isPending ? "Dispatching…" : "Confirm Dispatch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
