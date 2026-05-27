import { useState } from "react";
import { useListSales, ListSalesStatus } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, ShoppingCart, Search } from "lucide-react";

const STATUS_BADGE: Record<string, string> = {
  paid: "default", credit: "outline", partially_paid: "secondary", overdue: "destructive",
};

export default function SalesList() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useListSales({
    status: status !== "all" ? status as ListSalesStatus : undefined,
    search: search || undefined,
    page,
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales Invoices</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage customer invoices and payments</p>
        </div>
        <Button onClick={() => setLocation("/sales/new")} data-testid="button-new-sale">
          <Plus className="h-4 w-4 mr-2" />New Invoice
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9 w-56" placeholder="Search invoices..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} data-testid="input-search" />
        </div>
        <Select value={status} onValueChange={v => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-44" data-testid="select-status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="credit">Credit</SelectItem>
            <SelectItem value="partially_paid">Partially Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
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
                  <TableHead>Invoice No.</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                      <ShoppingCart className="mx-auto h-8 w-8 mb-2 opacity-30" />
                      No invoices found
                    </TableCell>
                  </TableRow>
                ) : (data?.data ?? []).map((s: any) => (
                  <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setLocation(`/sales/${s.id}`)} data-testid={`row-sale-${s.id}`}>
                    <TableCell className="font-mono text-sm font-semibold">{s.invoiceNumber}</TableCell>
                    <TableCell className="text-sm">{s.saleDate}</TableCell>
                    <TableCell>{s.customerName ?? `Customer #${s.customerId}`}</TableCell>
                    <TableCell className="capitalize text-sm">{s.paymentType}</TableCell>
                    <TableCell className="text-right text-sm">ETB {parseFloat(s.totalAmount).toLocaleString()}</TableCell>
                    <TableCell className="text-right text-sm">ETB {parseFloat(s.paidAmount).toLocaleString()}</TableCell>
                    <TableCell className="text-right text-sm font-medium">{parseFloat(s.balanceDue) > 0 ? `ETB ${parseFloat(s.balanceDue).toLocaleString()}` : "—"}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_BADGE[s.status] as any}>{s.status.replace(/_/g, " ")}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setLocation(`/sales/${s.id}`); }}>View</Button>
                    </TableCell>
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
