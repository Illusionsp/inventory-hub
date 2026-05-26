import React, { useState } from "react";
import {
  useListSuppliers,
  useCreateSupplier,
  useUpdateSupplier,
  useDeleteSupplier,
  getListSuppliersQueryKey,
} from "@workspace/api-client-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface SupplierForm {
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  taxNumber: string;
  isActive: boolean;
}

const emptyForm = (): SupplierForm => ({
  name: "",
  contactPerson: "",
  email: "",
  phone: "",
  address: "",
  taxNumber: "",
  isActive: true,
});

export default function SuppliersList() {
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<SupplierForm>(emptyForm());
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteName, setDeleteName] = useState("");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const params = React.useMemo(() => ({ search: search || undefined }), [search]);

  const { data: suppliersData, isLoading } = useListSuppliers(params);

  const createSupplier = useCreateSupplier();
  const updateSupplier = useUpdateSupplier();
  const deleteSupplier = useDeleteSupplier();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListSuppliersQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListSuppliersQueryKey(params) });
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFormOpen(true);
  };

  const openEdit = (supplier: any) => {
    setEditingId(supplier.id);
    setForm({
      name: supplier.name ?? "",
      contactPerson: supplier.contactPerson ?? "",
      email: supplier.email ?? "",
      phone: supplier.phone ?? "",
      address: supplier.address ?? "",
      taxNumber: supplier.taxNumber ?? "",
      isActive: supplier.isActive ?? true,
    });
    setFormOpen(true);
  };

  const setField = (field: keyof SupplierForm) => (val: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: val }));

  const handleSave = () => {
    if (!form.name.trim()) {
      toast({ title: "Supplier name is required", variant: "destructive" });
      return;
    }

    const payload = {
      name: form.name.trim(),
      contactPerson: form.contactPerson.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      taxNumber: form.taxNumber.trim() || null,
    };

    if (editingId !== null) {
      updateSupplier.mutate(
        { id: editingId, data: { ...payload, isActive: form.isActive } },
        {
          onSuccess: () => {
            toast({ title: "Supplier updated" });
            setFormOpen(false);
            invalidate();
          },
          onError: (err: any) => {
            const msg = err?.data?.error ?? err?.message ?? "Failed to update supplier";
            toast({ title: msg, variant: "destructive" });
          },
        }
      );
    } else {
      createSupplier.mutate(
        { data: payload },
        {
          onSuccess: () => {
            toast({ title: "Supplier added successfully" });
            setFormOpen(false);
            setForm(emptyForm());
            invalidate();
          },
          onError: (err: any) => {
            const msg = err?.data?.error ?? err?.message ?? "Failed to create supplier";
            toast({ title: msg, variant: "destructive" });
          },
        }
      );
    }
  };

  const handleDelete = () => {
    if (deleteId === null) return;
    const id = deleteId;
    deleteSupplier.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Supplier deleted" });
          setDeleteId(null);
          invalidate();
        },
        onError: (err: any) => {
          const msg = err?.data?.error ?? err?.message ?? "Failed to delete supplier";
          toast({
            title: msg,
            variant: "destructive",
            description: "Tip: deactivate the supplier instead to preserve GRN history.",
          });
          setDeleteId(null);
        },
      }
    );
  };

  const isMutating = createSupplier.isPending || updateSupplier.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Suppliers</h1>
          <p className="text-muted-foreground mt-1">
            Manage your vendors and raw material providers.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Add Supplier
        </Button>
      </div>

      <div className="flex items-center gap-4 bg-card p-4 rounded-xl border">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search suppliers..."
            className="pl-9 w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Supplier Name</TableHead>
              <TableHead>Contact Person</TableHead>
              <TableHead>Contact Info</TableHead>
              <TableHead className="w-[90px]">Status</TableHead>
              <TableHead className="text-right w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-[60px]" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-[60px] ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : (suppliersData?.data ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No suppliers found.
                </TableCell>
              </TableRow>
            ) : (
              (suppliersData?.data ?? []).map((supplier) => (
                <TableRow key={supplier.id} className="hover:bg-muted/40">
                  <TableCell className="font-medium">
                    {supplier.name}
                    {supplier.taxNumber && (
                      <div className="text-xs font-mono text-muted-foreground mt-0.5">
                        Tax: {supplier.taxNumber}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {supplier.contactPerson || "—"}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {supplier.email && <div>{supplier.email}</div>}
                      {supplier.phone && (
                        <div className="text-muted-foreground">{supplier.phone}</div>
                      )}
                      {!supplier.email && !supplier.phone && (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {supplier.isActive ? (
                      <Badge
                        variant="outline"
                        className="text-green-700 border-green-200 bg-green-50 dark:bg-green-900/20"
                      >
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(supplier)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setDeleteId(supplier.id);
                          setDeleteName(supplier.name);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add / Edit Dialog — explicit onClick, no form submit */}
      <Dialog open={formOpen} onOpenChange={(o) => { if (!isMutating) setFormOpen(o); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId !== null ? "Edit Supplier" : "Add Supplier"}</DialogTitle>
            <DialogDescription>
              {editingId !== null
                ? "Update supplier information."
                : "Fill in the details to add a new supplier."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="s-name">Name *</Label>
                <Input
                  id="s-name"
                  value={form.name}
                  onChange={(e) => setField("name")(e.target.value)}
                  placeholder="Supplier / company name"
                  onKeyDown={(e) => e.key === "Enter" && handleSave()}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-contact">Contact Person</Label>
                <Input
                  id="s-contact"
                  value={form.contactPerson}
                  onChange={(e) => setField("contactPerson")(e.target.value)}
                  placeholder="Full name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-tax">Tax Number</Label>
                <Input
                  id="s-tax"
                  value={form.taxNumber}
                  onChange={(e) => setField("taxNumber")(e.target.value)}
                  placeholder="TIN / VAT number"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-email">Email</Label>
                <Input
                  id="s-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setField("email")(e.target.value)}
                  placeholder="email@example.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-phone">Phone</Label>
                <Input
                  id="s-phone"
                  value={form.phone}
                  onChange={(e) => setField("phone")(e.target.value)}
                  placeholder="+251 ..."
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="s-addr">Address</Label>
                <Input
                  id="s-addr"
                  value={form.address}
                  onChange={(e) => setField("address")(e.target.value)}
                  placeholder="Street, city, region"
                />
              </div>
              {editingId !== null && (
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select
                    value={form.isActive ? "active" : "inactive"}
                    onValueChange={(v) => setField("isActive")(v === "active")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setFormOpen(false)}
              disabled={isMutating}
            >
              Cancel
            </Button>
            <Button type="button" disabled={isMutating} onClick={handleSave}>
              {isMutating
                ? "Saving..."
                : editingId !== null
                ? "Save Changes"
                : "Add Supplier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={deleteId !== null}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Supplier?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteName}</strong>? This cannot be undone.
              If this supplier has GRN records, deletion will be blocked — deactivate instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteId(null)}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={deleteSupplier.isPending}
              onClick={handleDelete}
            >
              {deleteSupplier.isPending ? "Deleting..." : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
