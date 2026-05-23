import { useState } from "react";
import { useListAuditLogs } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity } from "lucide-react";

const ACTION_BADGE: Record<string, string> = {
  create: "default", update: "secondary", delete: "destructive",
  approve: "default", reject: "destructive", login: "outline", logout: "outline",
};

export default function AuditLogs() {
  const [entityType, setEntityType] = useState("all");
  const [action, setAction] = useState("all");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useListAuditLogs({
    entityType: entityType !== "all" ? entityType : undefined,
    action: action !== "all" ? action : undefined,
    page,
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Complete trail of all system actions</p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Select value={entityType} onValueChange={v => { setEntityType(v); setPage(1); }}>
          <SelectTrigger className="w-48" data-testid="select-entity-type">
            <SelectValue placeholder="All entity types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Entities</SelectItem>
            {["grn", "transfer", "sale", "production_batch", "user", "product", "supplier", "customer"].map(e => (
              <SelectItem key={e} value={e}>{e.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={action} onValueChange={v => { setAction(v); setPage(1); }}>
          <SelectTrigger className="w-40" data-testid="select-action">
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {["create", "update", "delete", "approve", "reject", "login", "logout"].map(a => (
              <SelectItem key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Entity ID</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      <Activity className="mx-auto h-8 w-8 mb-2 opacity-30" />
                      No audit logs found
                    </TableCell>
                  </TableRow>
                ) : (data?.data ?? []).map((log: any) => (
                  <TableRow key={log.id} data-testid={`row-audit-${log.id}`}>
                    <TableCell className="font-medium text-sm">{log.userName ?? `User #${log.userId}`}</TableCell>
                    <TableCell>
                      <Badge variant={ACTION_BADGE[log.action] as any} className="text-xs">{log.action}</Badge>
                    </TableCell>
                    <TableCell className="text-sm capitalize">{log.entityType?.replace(/_/g, " ")}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{log.entityId ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground font-mono">{log.ipAddress ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {(data?.total ?? 0) > 50 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <span className="text-sm text-muted-foreground py-2">Page {page}</span>
          <Button variant="outline" size="sm" disabled={(page * 50) >= (data?.total ?? 0)} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}
