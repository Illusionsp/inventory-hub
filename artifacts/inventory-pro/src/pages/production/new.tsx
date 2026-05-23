import { useState } from "react";
import { useListStores, useListProducts, useCreateProductionBatch, getListProductionBatchesQueryKey } from "@workspace/api-client-react";
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

interface InputMaterial { productId: string; quantity: string; unit: string; }

export default function ProductionNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [type, setType] = useState("raw_to_semi");
  const [fromStoreId, setFromStoreId] = useState("");
  const [toStoreId, setToStoreId] = useState("");
  const [plannedOutputQty, setPlannedOutputQty] = useState("");
  const [productionDate, setProductionDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [inputs, setInputs] = useState<InputMaterial[]>([{ productId: "", quantity: "", unit: "KG" }]);

  const { data: stores } = useListStores();
  const { data: productsData } = useListProducts({ limit: 200 });
  const createBatch = useCreateProductionBatch();

  const addInput = () => setInputs(prev => [...prev, { productId: "", quantity: "", unit: "KG" }]);
  const removeInput = (i: number) => setInputs(prev => prev.filter((_, idx) => idx !== i));
  const updateInput = (i: number, field: keyof InputMaterial, value: string) =>
    setInputs(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!type || !fromStoreId || !toStoreId || !plannedOutputQty) {
      toast({ title: "Fill all required fields", variant: "destructive" }); return;
    }

    createBatch.mutate({
      data: {
        type,
        stageFromStoreId: parseInt(fromStoreId, 10),
        stageToStoreId: parseInt(toStoreId, 10),
        plannedOutputQty: parseFloat(plannedOutputQty),
        productionDate,
        notes: notes || undefined,
        inputMaterials: inputs.filter(i => i.productId && i.quantity).map(i => ({
          productId: parseInt(i.productId, 10),
          quantity: parseFloat(i.quantity),
          unit: i.unit,
        })),
      } as any,
    }, {
      onSuccess: (res: any) => {
        toast({ title: "Production batch created" });
        queryClient.invalidateQueries({ queryKey: getListProductionBatchesQueryKey() });
        setLocation(`/production/${res.id}`);
      },
      onError: () => toast({ title: "Failed to create batch", variant: "destructive" }),
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/production")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Production Batch</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Start a new production run</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Batch Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Production Type *</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger data-testid="select-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="raw_to_semi">Raw Material → Semi-Finished</SelectItem>
                  <SelectItem value="semi_to_finished">Semi-Finished → Finished</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Production Date *</Label>
              <Input type="date" value={productionDate} onChange={e => setProductionDate(e.target.value)} data-testid="input-production-date" />
            </div>
            <div className="space-y-1.5">
              <Label>Input Store *</Label>
              <Select value={fromStoreId} onValueChange={setFromStoreId}>
                <SelectTrigger data-testid="select-from-store"><SelectValue placeholder="Source store" /></SelectTrigger>
                <SelectContent>{(stores ?? []).map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Output Store *</Label>
              <Select value={toStoreId} onValueChange={setToStoreId}>
                <SelectTrigger data-testid="select-to-store"><SelectValue placeholder="Destination store" /></SelectTrigger>
                <SelectContent>{(stores ?? []).filter(s => String(s.id) !== fromStoreId).map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Planned Output Qty *</Label>
              <Input type="number" min="0" step="0.001" value={plannedOutputQty} onChange={e => setPlannedOutputQty(e.target.value)} placeholder="0.000" data-testid="input-planned-qty" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} data-testid="textarea-notes" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Input Materials</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addInput} data-testid="button-add-input">
              <Plus className="h-3.5 w-3.5 mr-1" />Add Input
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {inputs.map((inp, i) => (
              <div key={i} className="grid grid-cols-[1fr_140px_100px_40px] gap-3 items-end">
                <div className="space-y-1.5">
                  {i === 0 && <Label>Product</Label>}
                  <Select value={inp.productId} onValueChange={v => updateInput(i, "productId", v)}>
                    <SelectTrigger data-testid={`select-product-${i}`}><SelectValue placeholder="Product" /></SelectTrigger>
                    <SelectContent>{(productsData?.data ?? []).map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  {i === 0 && <Label>Quantity</Label>}
                  <Input type="number" min="0.001" step="0.001" value={inp.quantity} onChange={e => updateInput(i, "quantity", e.target.value)} placeholder="0.000" data-testid={`input-qty-${i}`} />
                </div>
                <div className="space-y-1.5">
                  {i === 0 && <Label>Unit</Label>}
                  <Input value={inp.unit} onChange={e => updateInput(i, "unit", e.target.value)} placeholder="KG" data-testid={`input-unit-${i}`} />
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => removeInput(i)} disabled={inputs.length === 1} data-testid={`button-remove-${i}`}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => setLocation("/production")} data-testid="button-cancel">Cancel</Button>
          <Button type="submit" disabled={createBatch.isPending} data-testid="button-submit">
            {createBatch.isPending ? "Creating..." : "Start Production"}
          </Button>
        </div>
      </form>
    </div>
  );
}
