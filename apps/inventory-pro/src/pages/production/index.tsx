import { useState } from "react";
import { useListProductionBatches, ListProductionBatchesStatus } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Factory } from "lucide-react";

const STATUS_BADGE: Record<string, string> = {
  in_progress: "outline", completed: "default", cancelled: "destructive",
};

export default function ProductionList() {
  const [, setLocation] = useLocation();
  const { hasPermission } = useAuth();
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useListProductionBatches({ status: status !== "all" ? status as ListProductionBatchesStatus : undefined, page });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Production Batches</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Track production runs, inputs, outputs & wastage</p>
        </div>
        {hasPermission("can_create_batch_production") && (
          <Button onClick={() => setLocation("/production/new")} data-testid="button-new-batch">
            <Plus className="h-4 w-4 mr-2" />New Batch
          </Button>
        )}
      </div>

      <div className="flex gap-3">
        <Select value={status} onValueChange={v => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-44" data-testid="select-status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch No.</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Planned Output</TableHead>
                  <TableHead className="text-right">Actual Output</TableHead>
                  <TableHead className="text-right">Yield %</TableHead>
                  <TableHead className="text-right">Wastage %</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                      <Factory className="mx-auto h-8 w-8 mb-2 opacity-30" />
                      No production batches found
                    </TableCell>
                  </TableRow>
                ) : (data?.data ?? []).map((b: any) => (
                  <TableRow key={b.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setLocation(`/production/${b.id}`)} data-testid={`row-batch-${b.id}`}>
                    <TableCell className="font-mono text-sm font-semibold">{b.batchNumber}</TableCell>
                    <TableCell className="text-sm">{b.type === "raw_to_semi" ? "Raw → Semi" : "Semi → Finished"}</TableCell>
                    <TableCell><Badge variant={STATUS_BADGE[b.status] as any}>{b.status.replace(/_/g, " ")}</Badge></TableCell>
                    <TableCell className="text-right">{b.plannedOutputQty} <span className="text-muted-foreground text-xs">{b.outputUnit}</span></TableCell>
                    <TableCell className="text-right">{b.actualOutputQty ? <>{b.actualOutputQty} <span className="text-muted-foreground text-xs">{b.outputUnit}</span></> : "—"}</TableCell>
                    <TableCell className="text-right">{b.yieldPercent ? `${parseFloat(b.yieldPercent).toFixed(1)}%` : "—"}</TableCell>
                    <TableCell className="text-right">{b.wastagePercent ? `${parseFloat(b.wastagePercent).toFixed(1)}%` : "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{b.productionDate ?? new Date(b.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell><Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setLocation(`/production/${b.id}`); }}>View</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {(data?.total ?? 0) > 20 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)} data-testid="button-prev-page">Previous</Button>
          <span className="text-sm text-muted-foreground py-2">Page {page}</span>
          <Button variant="outline" size="sm" disabled={(page * 20) >= (data?.total ?? 0)} onClick={() => setPage(p => p + 1)} data-testid="button-next-page">Next</Button>
        </div>
      )}
    </div>
  );
}
