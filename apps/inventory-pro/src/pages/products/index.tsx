import React, { useState } from "react";
import {
  useListProducts,
  useListCategories,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  getListProductsQueryKey,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Search, Trash2, Pencil, Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface ProductForm {
  name: string;
  sku: string;
  type: string;
  unit: string;
  categoryId: string;
  reorderLevel: string;
  unitCost: string;
  isActive: boolean;
}

const emptyForm = (): ProductForm => ({
  name: "",
  sku: "",
  type: "raw_material",
  unit: "kg",
  categoryId: "",
  reorderLevel: "0",
  unitCost: "",
  isActive: true,
});

const PRODUCT_TYPES = [
  { value: "raw_material", label: "Raw Material" },
  { value: "semi_finished", label: "Semi Finished" },
  { value: "finished", label: "Finished" },
  { value: "packaging", label: "Packaging" },
];

const COMMON_UNITS = ["kg", "g", "liter", "ml", "piece", "box", "bag", "ton", "meter", "unit"];

export default function ProductsList() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm());
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteName, setDeleteName] = useState("");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const params = React.useMemo(
    () => ({
      search: search || undefined,
      type: typeFilter !== "all" ? (typeFilter as any) : undefined,
      categoryId: categoryFilter !== "all" ? Number(categoryFilter) : undefined,
    }),
    [search, typeFilter, categoryFilter]
  );

  const { data: categories } = useListCategories();
  const { data: productsData, isLoading } = useListProducts(params);

  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListProductsQueryKey(params) });
  };

  const formatETB = (val: number | null | undefined) => {
    if (val == null) return "—";
    return `ETB ${val.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFormOpen(true);
  };

  const openEdit = (product: any) => {
    setEditingId(product.id);
    setForm({
      name: product.name ?? "",
      sku: product.sku ?? "",
      type: product.type ?? "raw_material",
      unit: product.unit ?? "kg",
      categoryId: product.categoryId ? String(product.categoryId) : "",
      reorderLevel: String(product.reorderLevel ?? 0),
      unitCost: product.unitCost != null ? String(parseFloat(String(product.unitCost))) : "",
      isActive: product.isActive ?? true,
    });
    setFormOpen(true);
  };

  const setField = (field: keyof ProductForm) => (val: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: val }));

  const handleSave = () => {
    if (!form.name.trim()) {
      toast({ title: "Product name is required", variant: "destructive" });
      return;
    }
    if (!form.type) {
      toast({ title: "Product type is required", variant: "destructive" });
      return;
    }
    if (!form.unit.trim()) {
      toast({ title: "Unit of measure is required", variant: "destructive" });
      return;
    }

    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim() || null,
      type: form.type,
      unit: form.unit.trim(),
      categoryId: form.categoryId ? Number(form.categoryId) : null,
      reorderLevel: form.reorderLevel ? Number(form.reorderLevel) : 0,
      unitCost: form.unitCost ? Number(form.unitCost) : null,
      isActive: form.isActive,
    };

    if (editingId !== null) {
      updateProduct.mutate(
        { id: editingId, data: payload },
        {
          onSuccess: () => {
            toast({ title: "Product updated" });
            setFormOpen(false);
            invalidate();
          },
          onError: (err: any) => {
            const msg = err?.data?.error ?? err?.message ?? "Failed to update product";
            toast({ title: msg, variant: "destructive" });
          },
        }
      );
    } else {
      createProduct.mutate(
        { data: payload as any },
        {
          onSuccess: () => {
            toast({ title: "Product created" });
            setFormOpen(false);
            invalidate();
          },
          onError: (err: any) => {
            const msg = err?.data?.error ?? err?.message ?? "Failed to create product";
            toast({ title: msg, variant: "destructive" });
          },
        }
      );
    }
  };

  const handleDelete = () => {
    if (deleteId === null) return;
    const id = deleteId;
    deleteProduct.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Product deleted" });
          setDeleteId(null);
          invalidate();
        },
        onError: (err: any) => {
          const msg = err?.data?.error ?? err?.message ?? "Failed to delete product";
          toast({ title: msg, variant: "destructive" });
          setDeleteId(null);
        },
      }
    );
  };

  const isMutating = updateProduct.isPending || createProduct.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Products</h1>
          <p className="text-muted-foreground mt-1">
            Manage raw materials, semi-finished, and finished goods.
          </p>
        </div>
        <Button onClick={openAdd} data-testid="button-add-product">
          <Plus className="h-4 w-4 mr-2" />
          Add Product
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 bg-card p-4 rounded-xl border">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products by name or SKU..."
            className="pl-9 w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {PRODUCT_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {((categories as any) ?? []).map((cat: any) => (
              <SelectItem key={cat.id} value={cat.id.toString()}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>SKU</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Unit Cost</TableHead>
              <TableHead className="text-right">Reorder Lvl</TableHead>
              <TableHead className="w-[80px]">Status</TableHead>
              <TableHead className="text-right w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-[100px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[80px] ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[60px] ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-[60px]" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-[60px] ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : (productsData?.data ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  No products found.
                </TableCell>
              </TableRow>
            ) : (
              (productsData?.data ?? []).map((product) => (
                <TableRow key={product.id} className="hover:bg-muted/40">
                  <TableCell className="font-mono text-muted-foreground text-sm">
                    {product.sku || "—"}
                  </TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize font-normal text-xs bg-muted/50">
                      {product.type.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {(product as any).categoryName || "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatETB(product.unitCost != null ? parseFloat(String(product.unitCost)) : null)}
                    <span className="text-muted-foreground text-xs ml-1">/{product.unit}</span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">
                    {product.reorderLevel}
                  </TableCell>
                  <TableCell>
                    {product.isActive ? (
                      <Badge variant="outline" className="text-green-700 border-green-200 bg-green-50 dark:bg-green-900/20">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(product)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { setDeleteId(product.id); setDeleteName(product.name); }}
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
            <DialogTitle>{editingId === null ? "Add Product" : "Edit Product"}</DialogTitle>
            <DialogDescription>{editingId === null ? "Register a new product in the catalog." : "Update product details."}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="p-name">Name *</Label>
                <Input
                  id="p-name"
                  value={form.name}
                  onChange={(e) => setField("name")(e.target.value)}
                  placeholder="Product name"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="p-type">Type *</Label>
                <Select value={form.type} onValueChange={setField("type")}>
                  <SelectTrigger id="p-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="p-unit">Unit *</Label>
                <Select value={form.unit} onValueChange={setField("unit")}>
                  <SelectTrigger id="p-unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_UNITS.map((u) => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="p-sku">SKU</Label>
                <Input
                  id="p-sku"
                  value={form.sku}
                  onChange={(e) => setField("sku")(e.target.value)}
                  placeholder="e.g. RM-001"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="p-cat">Category</Label>
                <Select
                  value={form.categoryId || "none"}
                  onValueChange={(v) => setField("categoryId")(v === "none" ? "" : v)}
                >
                  <SelectTrigger id="p-cat">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {((categories as any) ?? []).map((cat: any) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="p-cost">Unit Cost (ETB)</Label>
                <Input
                  id="p-cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.unitCost}
                  onChange={(e) => setField("unitCost")(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="p-reorder">Reorder Level</Label>
                <Input
                  id="p-reorder"
                  type="number"
                  min="0"
                  value={form.reorderLevel}
                  onChange={(e) => setField("reorderLevel")(e.target.value)}
                  placeholder="0"
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
            <Button
              type="button"
              disabled={isMutating}
              onClick={handleSave}
            >
              {isMutating ? "Saving..." : "Save Changes"}
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
            <AlertDialogTitle>Delete Product?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteName}</strong>? This cannot be undone.
              Existing GRN, production, and sales records referencing this product will not be
              affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteId(null)}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={deleteProduct.isPending}
              onClick={handleDelete}
            >
              {deleteProduct.isPending ? "Deleting..." : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
