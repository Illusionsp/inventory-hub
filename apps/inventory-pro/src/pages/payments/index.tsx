import { useState } from "react";
import { useListPayments, useListSales } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, CreditCard } from "lucide-react";
import { useLocation } from "wouter";

export default function Payments() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("credits");
  const [creditsPage, setCreditsPage] = useState(1);
  const [paymentsPage, setPaymentsPage] = useState(1);

  const { data: paymentsData, isLoading: paymentsLoading } = useListPayments({ page: paymentsPage });
  const { data: creditsData, isLoading: creditsLoading } = useListSales({ status: "credit", page: creditsPage });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Credit & Payments</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Track unpaid customer balances and review received payments</p>
      </div>

      <Tabs defaultValue="credits" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="credits">Active Credits</TabsTrigger>
          <TabsTrigger value="payments">Payment History</TabsTrigger>
        </TabsList>

        <TabsContent value="credits">
          <Card>
            <CardContent className="p-0">
              {creditsLoading ? (
                <div className="p-6 space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Sale Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead className="text-right">Total Amount</TableHead>
                      <TableHead className="text-right">Balance Due</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(creditsData?.data ?? []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                          <AlertCircle className="mx-auto h-8 w-8 mb-2 opacity-30" />
                          No active credits found
                        </TableCell>
                      </TableRow>
                    ) : (creditsData?.data ?? []).map((sale: any) => (
                      <TableRow key={sale.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setLocation(`/sales/${sale.id}`)}>
                        <TableCell className="font-mono text-sm font-semibold">{sale.invoiceNumber}</TableCell>
                        <TableCell>{sale.customerName ?? "—"}</TableCell>
                        <TableCell className="text-sm">{sale.saleDate}</TableCell>
                        <TableCell className="text-sm">
                          {sale.dueDate ? (
                            <span className={new Date(sale.dueDate) < new Date() ? "text-destructive font-semibold" : "text-muted-foreground"}>
                              {sale.dueDate}
                            </span>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium">ETB {parseFloat(sale.totalAmount).toLocaleString()}</TableCell>
                        <TableCell className="text-right font-bold text-destructive">ETB {parseFloat(sale.balanceDue).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          {(creditsData?.total ?? 0) > 20 && (
            <div className="flex justify-center gap-2 mt-6">
              <Button variant="outline" size="sm" disabled={creditsPage === 1} onClick={() => setCreditsPage(p => p - 1)}>Previous</Button>
              <span className="text-sm text-muted-foreground py-2">Page {creditsPage}</span>
              <Button variant="outline" size="sm" disabled={(creditsPage * 20) >= (creditsData?.total ?? 0)} onClick={() => setCreditsPage(p => p + 1)}>Next</Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardContent className="p-0">
              {paymentsLoading ? (
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
                    {(paymentsData?.data ?? []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                          <CreditCard className="mx-auto h-8 w-8 mb-2 opacity-30" />
                          No payments recorded
                        </TableCell>
                      </TableRow>
                    ) : (paymentsData?.data ?? []).map((p: any) => (
                      <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setLocation(`/sales/${p.saleId}`)}>
                        <TableCell className="font-mono text-sm font-semibold">{p.invoiceNumber}</TableCell>
                        <TableCell>{p.customerName ?? "—"}</TableCell>
                        <TableCell className="text-sm">{p.paymentDate}</TableCell>
                        <TableCell className="capitalize text-sm">{p.paymentMethod.replace(/_/g, " ")}</TableCell>
                        <TableCell className="text-right font-medium text-green-600">ETB {parseFloat(p.amount).toLocaleString()}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{p.reference ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          {(paymentsData?.total ?? 0) > 20 && (
            <div className="flex justify-center gap-2 mt-6">
              <Button variant="outline" size="sm" disabled={paymentsPage === 1} onClick={() => setPaymentsPage(p => p - 1)}>Previous</Button>
              <span className="text-sm text-muted-foreground py-2">Page {paymentsPage}</span>
              <Button variant="outline" size="sm" disabled={(paymentsPage * 20) >= (paymentsData?.total ?? 0)} onClick={() => setPaymentsPage(p => p + 1)}>Next</Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
