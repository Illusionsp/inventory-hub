import React, { useState } from "react";
import { useListInventory, useListStores } from "@workspace/api-client-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, SlidersHorizontal } from "lucide-react";

export default function InventoryList() {
  const [search, setSearch] = useState("");
  const [storeId, setStoreId] = useState<string>("all");
  const [isLowStock, setIsLowStock] = useState<string>("all");

  const { data: stores } = useListStores();
  const { data: inventoryData, isLoading } = useListInventory({
    storeId: storeId !== "all" ? Number(storeId) : undefined,
    lowStock: isLowStock === "true" ? true : undefined,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Stock Levels</h1>
          <p className="text-muted-foreground mt-1">
            View real-time inventory across all stores.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 bg-card p-4 rounded-lg border">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            className="pl-9 w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={storeId} onValueChange={setStoreId}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="All Stores" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stores</SelectItem>
            {stores?.map((store) => (
              <SelectItem key={store.id} value={store.id.toString()}>
                {store.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={isLowStock} onValueChange={setIsLowStock}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Stock Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stock</SelectItem>
            <SelectItem value="true">Low Stock Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Product</TableHead>
              <TableHead>Store</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead className="text-right">Reorder Level</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-[250px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[80px] ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[80px] ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-[60px]" /></TableCell>
                </TableRow>
              ))
            ) : inventoryData?.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No inventory items found.
                </TableCell>
              </TableRow>
            ) : (
              inventoryData?.data.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span className="truncate">{item.productName}</span>
                      {item.productType && (
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-sm capitalize">
                          {item.productType.replace("_", " ")}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{item.storeName}</TableCell>
                  <TableCell className="text-right font-mono">
                    {item.quantity} {item.unit}
                  </TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">
                    {item.reorderLevel || 0}
                  </TableCell>
                  <TableCell>
                    {item.isLowStock ? (
                      <Badge variant="destructive" className="font-mono">Low Stock</Badge>
                    ) : (
                      <Badge variant="secondary" className="font-mono text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30">Healthy</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
