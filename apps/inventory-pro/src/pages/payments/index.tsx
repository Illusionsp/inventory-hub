import { useState } from "react";
import { useListPayments } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard } from "lucide-react";
import { useLocation } from "wouter";

export default function Payments() {
  const [, setLocation] = useLocation();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useListPayments({ page });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payment History</h1>
        <p className="text-muted-foreground text-sm mt-0.5">All received payments for credit sales</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      <CreditCard className="mx-auto h-8 w-8 mb-2 opacity-30" />
                      No payments recorded
                    </TableCell>
                  </TableRow>
                ) : (data?.data ?? []).map((p: any) => (
                  <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setLocation(`/sales/${p.saleId}`)} data-testid={`row-payment-${p.id}`}>
                    <TableCell className="font-mono text-sm font-semibold">{p.invoiceNumber}</TableCell>
                    <TableCell>{p.customerName ?? "—"}</TableCell>
                    <TableCell className="text-sm">{p.paymentDate}</TableCell>
                    <TableCell className="capitalize text-sm">{p.paymentMethod.replace(/_/g, " ")}</TableCell>
                    <TableCell className="text-right font-medium">ETB {parseFloat(p.amount).toLocaleString()}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.reference ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {(data?.total ?? 0) > 20 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)} data-testid="button-prev">Previous</Button>
          <span className="text-sm text-muted-foreground py-2">Page {page}</span>
          <Button variant="outline" size="sm" disabled={(page * 20) >= (data?.total ?? 0)} onClick={() => setPage(p => p + 1)} data-testid="button-next">Next</Button>
        </div>
      )}
    </div>
  );
}
