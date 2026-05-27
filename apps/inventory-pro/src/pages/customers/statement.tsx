import React from "react";
import { useParams, Link } from "wouter";
import { useGetCustomerStatement } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Printer } from "lucide-react";
import { format } from "date-fns";

export default function CustomerStatement() {
  const params = useParams();
  const id = Number(params.id);

  const { data: statement, isLoading } = useGetCustomerStatement(id, {
    query: { enabled: !!id, queryKey: ['getCustomerStatement', id] },
  });

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-[200px]" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!statement) return <div>Statement not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/customers">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Statement: {statement.customer.name}</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {statement.customer.email} {statement.customer.phone ? `• ${statement.customer.phone}` : ""}
            </p>
          </div>
        </div>
        <Button variant="outline">
          <Printer className="mr-2 h-4 w-4" /> Print
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(statement.totalSales)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Paid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600 dark:text-green-500">{formatCurrency(statement.totalPaid)}</div>
          </CardContent>
        </Card>
        <Card className={statement.outstandingBalance > 0 ? "border-destructive/50 bg-destructive/5" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${statement.outstandingBalance > 0 ? "text-destructive" : ""}`}>
              {formatCurrency(statement.outstandingBalance)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="p-4 border-b bg-muted/20">
          <h2 className="font-semibold">Recent Transactions</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Date</TableHead>
              <TableHead>Invoice #</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total Amount</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {statement.sales.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No sales found for this customer.
                </TableCell>
              </TableRow>
            ) : (
              statement.sales.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {format(new Date(sale.saleDate), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="font-medium font-mono text-sm">{sale.invoiceNumber}</TableCell>
                  <TableCell>
                    <Badge variant={sale.status === "paid" ? "secondary" : "destructive"} className="capitalize font-normal text-xs">
                      {sale.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(sale.totalAmount)}</TableCell>
                  <TableCell className="text-right font-mono text-green-600 dark:text-green-500">{formatCurrency(sale.paidAmount || 0)}</TableCell>
                  <TableCell className="text-right font-mono text-destructive">{formatCurrency(sale.balanceDue || 0)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
