import { useState } from "react";
import { useGetProductionBatch, useCompleteProductionBatch, getListProductionBatchesQueryKey, useListProducts } from "@workspace/api-client-react";
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
import { ArrowLeft, CheckCircle, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface OutputProduct { productId: string; quantity: string; unit: string; }

export default function ProductionDetail({ id }: { id: string }) {
  const batchId = parseInt(id, 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [actualOutputQty, setActualOutputQty] = useState("");
  const [wastageQty, setWastageQty] = useState("");
  const [outputs, setOutputs] = useState<OutputProduct[]>([{ productId: "", quantity: "", unit: "KG" }]);

  const { data: batch, isLoading } = useGetProductionBatch(batchId, { query: { enabled: !!batchId, queryKey: ['getProductionBatch', batchId] } });
  const { data: productsData } = useListProducts({ limit: 200 });
  const completeBatch = useCompleteProductionBatch();

  const addOutput = () => setOutputs(prev => [...prev, { productId: "", quantity: "", unit: "KG" }]);
  const removeOutput = (i: number) => setOutputs(prev => prev.filter((_, idx) => idx !== i));
  const updateOutput = (i: number, field: keyof OutputProduct, value: string) =>
    setOutputs(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));

  const handleComplete = () => {
    if (!actualOutputQty || !wastageQty) {
      toast({ title: "Enter actual output and wastage", variant: "destructive" }); return;
    }
    completeBatch.mutate({
      id: batchId,
      data: {
        actualOutputQty: parseFloat(actualOutputQty),
        wastageQty: parseFloat(wastageQty),
        outputProducts: outputs.filter(o => o.productId && o.quantity).map(o => ({
          productId: parseInt(o.productId, 10), quantity: parseFloat(o.quantity), unit: o.unit,
        })),
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
          { label: "Planned Output", value: planned },
          { label: "Actual Output", value: actual ?? "—" },
          { label: "Wastage", value: wastage ?? "—" },
          { label: "Yield %", value: yieldPct ? `${yieldPct}%` : "—" },
          { label: "Wastage %", value: wastagePct ? `${wastagePct}%` : "—" },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-lg font-bold mt-1" data-testid={`text-${label.toLowerCase().replace(/\s+/g, "-")}`}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

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
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Actual Output Qty *</Label>
                <Input type="number" min="0" step="0.001" value={actualOutputQty} onChange={e => setActualOutputQty(e.target.value)} placeholder="0.000" data-testid="input-actual-qty" />
              </div>
              <div className="space-y-1.5">
                <Label>Wastage Qty *</Label>
                <Input type="number" min="0" step="0.001" value={wastageQty} onChange={e => setWastageQty(e.target.value)} placeholder="0.000" data-testid="input-wastage-qty" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <Label>Output Products</Label>
                <Button type="button" variant="outline" size="sm" onClick={addOutput} data-testid="button-add-output">
                  <Plus className="h-3.5 w-3.5 mr-1" />Add
                </Button>
              </div>
              {outputs.map((out, i) => (
                <div key={i} className="grid grid-cols-[1fr_140px_100px_40px] gap-3 items-end mb-3">
                  <Select value={out.productId} onValueChange={v => updateOutput(i, "productId", v)}>
                    <SelectTrigger data-testid={`select-output-product-${i}`}><SelectValue placeholder="Product" /></SelectTrigger>
                    <SelectContent>{(productsData?.data ?? []).map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input type="number" min="0.001" step="0.001" value={out.quantity} onChange={e => updateOutput(i, "quantity", e.target.value)} placeholder="0.000" data-testid={`input-output-qty-${i}`} />
                  <Input value={out.unit} onChange={e => updateOutput(i, "unit", e.target.value)} placeholder="KG" data-testid={`input-output-unit-${i}`} />
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeOutput(i)} disabled={outputs.length === 1}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

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
    </div>
  );
}
