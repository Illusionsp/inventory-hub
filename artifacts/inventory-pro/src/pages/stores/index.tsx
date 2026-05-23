import { useState } from "react";
import { useListStores, useCreateStore, getListStoresQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Store } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STORE_TYPES: Record<string, string> = {
  main_raw_material: "Raw Material", semi_finished: "Semi-Finished",
  final_production: "Final Production", main_finished: "Finished Goods",
};

export default function StoresPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("main_raw_material");
  const [location, setLocation] = useState("");

  const { data: stores, isLoading } = useListStores();
  const createStore = useCreateStore();

  const handleCreate = () => {
    if (!name || !type) { toast({ title: "Fill required fields", variant: "destructive" }); return; }
    createStore.mutate({
      data: { name, type, location: location || undefined } as any,
    }, {
      onSuccess: () => {
        toast({ title: "Store created" });
        setDialogOpen(false); setName(""); setType("main_raw_material"); setLocation("");
        queryClient.invalidateQueries({ queryKey: getListStoresQueryKey() });
      },
      onError: () => toast({ title: "Failed to create store", variant: "destructive" }),
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Store Management</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Configure storage locations and their types</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} data-testid="button-new-store">
          <Plus className="h-4 w-4 mr-2" />New Store
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-center text-muted-foreground">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(stores ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                      <Store className="mx-auto h-8 w-8 mb-2 opacity-30" />
                      No stores configured
                    </TableCell>
                  </TableRow>
                ) : (stores ?? []).map((s) => (
                  <TableRow key={s.id} data-testid={`row-store-${s.id}`}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell><Badge variant="outline">{STORE_TYPES[s.type] ?? s.type}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.location ?? "—"}</TableCell>
                    <TableCell><Badge variant={s.isActive ? "default" : "secondary"}>{s.isActive ? "Active" : "Inactive"}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Store</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Store Name *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} data-testid="input-name" />
            </div>
            <div className="space-y-1.5">
              <Label>Store Type *</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger data-testid="select-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STORE_TYPES).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Building, floor, etc." data-testid="input-location" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createStore.isPending} data-testid="button-create-store">
              {createStore.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
