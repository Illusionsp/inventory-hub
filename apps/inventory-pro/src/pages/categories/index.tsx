import React, { useState } from "react";
import {
  useListCategories,
  useCreateCategory,
  useDeleteCategory,
  getListCategoriesQueryKey,
} from "@workspace/api-client-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface CategoryForm {
  name: string;
  code: string;
  description: string;
}

const emptyForm = (): CategoryForm => ({ name: "", code: "", description: "" });

export default function CategoriesList() {
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<CategoryForm>(emptyForm());
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteName, setDeleteName] = useState("");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: categories, isLoading } = useListCategories();

  const createCategory = useCreateCategory();
  const deleteCategory = useDeleteCategory();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
  };

  const openCreate = () => {
    setForm(emptyForm());
    setFormOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast({ title: "Category name is required", variant: "destructive" });
      return;
    }

    createCategory.mutate(
      {
        data: {
          name: form.name.trim(),
          code: form.code.trim() || null,
          description: form.description.trim() || null,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Category added successfully" });
          setFormOpen(false);
          setForm(emptyForm());
          invalidate();
        },
        onError: (err: any) => {
          const msg = err?.data?.error ?? err?.message ?? "Failed to create category";
          toast({ title: msg, variant: "destructive" });
        },
      }
    );
  };

  const handleDelete = () => {
    if (deleteId === null) return;
    const id = deleteId;
    deleteCategory.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Category deleted" });
          setDeleteId(null);
          invalidate();
        },
        onError: (err: any) => {
          const msg = err?.data?.error ?? err?.message ?? "Failed to delete category";
          toast({ title: msg, variant: "destructive" });
          setDeleteId(null);
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
          <p className="text-muted-foreground mt-1">
            Manage product categories and classifications.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Add Category
        </Button>
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[80px]">ID</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right w-[80px]">Delete</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-[40px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[300px]" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-[40px] ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : (categories ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  No categories yet. Click "Add Category" to create one.
                </TableCell>
              </TableRow>
            ) : (
              (categories ?? []).map((category) => (
                <TableRow key={category.id} className="hover:bg-muted/40">
                  <TableCell className="font-mono text-muted-foreground text-sm">
                    {category.id}
                  </TableCell>
                  <TableCell className="font-mono text-muted-foreground">
                    {category.code || "—"}
                  </TableCell>
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {category.description || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setDeleteId(category.id);
                        setDeleteName(category.name);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Category Dialog — explicit onClick, no form submit */}
      <Dialog
        open={formOpen}
        onOpenChange={(o) => { if (!createCategory.isPending) setFormOpen(o); }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Category</DialogTitle>
            <DialogDescription>
              Create a new product category for grouping items.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="cat-name">Name *</Label>
                <Input
                  id="cat-name"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Raw Chemicals"
                  onKeyDown={(e) => e.key === "Enter" && handleSave()}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cat-code">Code</Label>
                <Input
                  id="cat-code"
                  value={form.code}
                  onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                  placeholder="e.g. RC"
                  onKeyDown={(e) => e.key === "Enter" && handleSave()}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-desc">Description</Label>
              <Input
                id="cat-desc"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Optional description"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setFormOpen(false)}
              disabled={createCategory.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={createCategory.isPending}
              onClick={handleSave}
            >
              {createCategory.isPending ? "Saving..." : "Add Category"}
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
            <AlertDialogTitle>Delete Category?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteName}</strong>? Products in this
              category will become uncategorized.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteId(null)}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={deleteCategory.isPending}
              onClick={handleDelete}
            >
              {deleteCategory.isPending ? "Deleting..." : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
