import React from "react";
import {
  useListCustomers,
  useCreateCustomer,
  useUpdateCustomer,
  useDeleteCustomer,
  getListCustomersQueryKey,
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search, FileText, Pencil, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface CustomerFormState {
  name: string;
  type: string;
  email: string;
  phone: string;
  address: string;
  taxNumber: string;
  isActive: boolean;
}

const emptyForm = (): CustomerFormState => ({
  name: "",
  type: "individual",
  email: "",
  phone: "",
  address: "",
  taxNumber: "",
  isActive: true,
});

export default function CustomersList() {
  const [search, setSearch] = React.useState("");
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [deleteId, setDeleteId] = React.useState<number | null>(null);
  const [deleteName, setDeleteName] = React.useState("");
  const [form, setForm] = React.useState<CustomerFormState>(emptyForm());

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: customersData, isLoading } = useListCustomers({
    search: search || undefined,
  });

  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();

  const formatETB = (val: number | null | undefined) => {
    if (val == null) return "ETB 0.00";
    return `ETB ${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFormOpen(true);
  };

  const openEdit = (customer: any) => {
    setEditingId(customer.id);
    setForm({
      name: customer.name ?? "",
      type: customer.type ?? "individual",
      email: customer.email ?? "",
      phone: customer.phone ?? "",
      address: customer.address ?? "",
      taxNumber: customer.taxNumber ?? "",
      isActive: customer.isActive ?? true,
    });
    setFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.type) {
      toast({ title: "Name and type are required", variant: "destructive" });
      return;
    }

    const payload: any = {
      name: form.name,
      type: form.type,
      email: form.email || undefined,
      phone: form.phone || undefined,
      address: form.address || undefined,
      taxNumber: form.taxNumber || undefined,
      isActive: form.isActive,
    };

    if (editingId) {
      updateCustomer.mutate(
        { id: editingId, data: payload },
        {
          onSuccess: () => {
            toast({ title: "Customer updated" });
            setFormOpen(false);
            invalidate();
          },
          onError: () => toast({ title: "Failed to update", variant: "destructive" }),
        }
      );
    } else {
      createCustomer.mutate(
        { data: payload },
        {
          onSuccess: () => {
            toast({ title: "Customer added" });
            setFormOpen(false);
            invalidate();
          },
          onError: () => toast({ title: "Failed to create", variant: "destructive" }),
        }
      );
    }
  };

  const confirmDelete = () => {
    if (!deleteId) return;
    deleteCustomer.mutate(
      { id: deleteId },
      {
        onSuccess: () => {
          toast({ title: "Customer deleted" });
          setDeleteId(null);
          invalidate();
        },
        onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
      }
    );
  };

  const set = (field: keyof CustomerFormState) => (val: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: val }));

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground mt-1">Manage buyers and their credit balances.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Add Customer
        </Button>
      </div>

      <div className="flex items-center gap-4 bg-card p-4 rounded-xl border">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search customers..."
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
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead className="text-right">Credit Balance</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-[80px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[80px] ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-[60px]" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-[120px] ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : (customersData?.data ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No customers found.
                </TableCell>
              </TableRow>
            ) : (
              (customersData?.data ?? []).map((customer: any) => (
                <TableRow key={customer.id} className="hover:bg-muted/40">
                  <TableCell className="font-medium">
                    {customer.name}
                    {customer.taxNumber && (
                      <div className="text-xs font-mono text-muted-foreground mt-0.5">
                        Tax: {customer.taxNumber}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize font-normal text-xs bg-muted/50">
                      {customer.type?.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {customer.email && <div>{customer.email}</div>}
                      {customer.phone && (
                        <div className="text-muted-foreground">{customer.phone}</div>
                      )}
                      {!customer.email && !customer.phone && (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    <span
                      className={
                        (customer.creditBalance || 0) > 0 ? "text-destructive font-semibold" : ""
                      }
                    >
                      {formatETB(parseFloat(String(customer.creditBalance || 0)))}
                    </span>
                  </TableCell>
                  <TableCell>
                    {customer.isActive ? (
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
                      <Button variant="ghost" size="icon" onClick={() => openEdit(customer)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/customers/${customer.id}/statement`}>
                          <FileText className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setDeleteId(customer.id);
                          setDeleteName(customer.name);
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

      {/* Create / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Customer" : "Add Customer"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Update customer information." : "Fill in the details to add a new customer."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => set("name")(e.target.value)}
                  placeholder="Customer name"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Type *</Label>
                <Select value={form.type} onValueChange={set("type")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                    <SelectItem value="government">Government</SelectItem>
                    <SelectItem value="non_profit">Non-Profit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Tax Number</Label>
                <Input
                  value={form.taxNumber}
                  onChange={(e) => set("taxNumber")(e.target.value)}
                  placeholder="TIN / VAT number"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email")(e.target.value)}
                  placeholder="email@example.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => set("phone")(e.target.value)}
                  placeholder="+251 ..."
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Address</Label>
                <Input
                  value={form.address}
                  onChange={(e) => set("address")(e.target.value)}
                  placeholder="Street, city, region"
                />
              </div>
              {editingId && (
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select
                    value={form.isActive ? "active" : "inactive"}
                    onValueChange={(v) => set("isActive")(v === "active")}
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createCustomer.isPending || updateCustomer.isPending}
              >
                {editingId ? "Save Changes" : "Add Customer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteName}</strong>? This action cannot be
              undone. Existing transaction records will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
