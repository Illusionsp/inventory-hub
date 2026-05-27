import React, { useState } from "react";
import { useListInventoryMovements, useListStores } from "@workspace/api-client-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search } from "lucide-react";
import { format } from "date-fns";

export default function InventoryMovements() {
  const [search, setSearch] = useState("");
  const [storeId, setStoreId] = useState<string>("all");
  const [movementType, setMovementType] = useState<string>("all");

  const { data: stores } = useListStores();
  const { data: movementsData, isLoading } = useListInventoryMovements({
    storeId: storeId !== "all" ? Number(storeId) : undefined,
    movementType: movementType !== "all" ? movementType : undefined,
  });

  const getMovementBadgeVariant = (type: string) => {
    switch (type) {
      case "grn_receipt":
      case "transfer_in":
      case "production_output":
        return "default";
      case "sale":
      case "transfer_out":
      case "production_input":
      case "wastage":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Movements Log</h1>
          <p className="text-muted-foreground mt-1">
            Audit trail of all inventory additions and deductions.
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
        <Select value={movementType} onValueChange={setMovementType}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Movement Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="grn_receipt">GRN Receipt</SelectItem>
            <SelectItem value="transfer_in">Transfer In</SelectItem>
            <SelectItem value="transfer_out">Transfer Out</SelectItem>
            <SelectItem value="production_input">Production Input</SelectItem>
            <SelectItem value="production_output">Production Output</SelectItem>
            <SelectItem value="sale">Sale</SelectItem>
            <SelectItem value="wastage">Wastage</SelectItem>
            <SelectItem value="adjustment">Adjustment</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Date</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Store</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead>Reference</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-[100px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[60px] ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                </TableRow>
              ))
            ) : movementsData?.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No movements found.
                </TableCell>
              </TableRow>
            ) : (
              movementsData?.data.map((movement) => (
                <TableRow key={movement.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {format(new Date(movement.createdAt), "MMM d, yyyy HH:mm")}
                  </TableCell>
                  <TableCell className="font-medium">{movement.productName}</TableCell>
                  <TableCell>{movement.storeName}</TableCell>
                  <TableCell>
                    <Badge variant={getMovementBadgeVariant(movement.movementType)} className="capitalize font-normal text-xs">
                      {movement.movementType.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    <span className={movement.quantity > 0 ? "text-green-600 dark:text-green-400" : "text-destructive"}>
                      {movement.quantity > 0 ? "+" : ""}{movement.quantity}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm font-mono">
                    {movement.referenceType} #{movement.referenceId}
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
