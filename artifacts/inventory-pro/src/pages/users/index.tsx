import { useState } from "react";
import { useListUsers, useCreateUser, getListUsersQueryKey } from "@workspace/api-client-react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Users, KeyRound } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ROLES = ["super_admin", "store_manager", "production_manager", "sales_officer", "finance_officer", "approver"];
const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin", store_manager: "Store Manager", production_manager: "Production Manager",
  sales_officer: "Sales Officer", finance_officer: "Finance Officer", approver: "Approver",
};

export default function UsersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  // Create user dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("sales_officer");

  // Set password dialog
  const [pwDialogOpen, setPwDialogOpen] = useState(false);
  const [pwTarget, setPwTarget] = useState<{ id: number; name: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  const { data, isLoading } = useListUsers({ page, limit: 20 });
  const createUser = useCreateUser();

  const setPasswordMutation = useMutation({
    mutationFn: async ({ id, password }: { id: number; password: string }) => {
      const res = await fetch(`/api/users/${id}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to set password");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Password updated", description: `Password changed for ${pwTarget?.name}` });
      setPwDialogOpen(false);
      setPwTarget(null);
      setNewPassword("");
      setConfirmPassword("");
      setShowPw(false);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleCreate = () => {
    if (!name || !email || !password || !role) { toast({ title: "Fill all fields", variant: "destructive" }); return; }
    createUser.mutate(
      { data: { name, email, password, role } as any },
      {
        onSuccess: () => {
          toast({ title: "User created" });
          setDialogOpen(false); setName(""); setEmail(""); setPassword(""); setRole("sales_officer");
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        },
        onError: () => toast({ title: "Failed to create user", variant: "destructive" }),
      }
    );
  };

  const openSetPassword = (user: { id: number; name: string }) => {
    setPwTarget(user);
    setNewPassword("");
    setConfirmPassword("");
    setShowPw(false);
    setPwDialogOpen(true);
  };

  const handleSetPassword = () => {
    if (!newPassword || newPassword.length < 6) {
      toast({ title: "Password too short", description: "At least 6 characters required", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (!pwTarget) return;
    setPasswordMutation.mutate({ id: pwTarget.id, password: newPassword });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage system users and roles</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} data-testid="button-new-user">
          <Plus className="h-4 w-4 mr-2" />New User
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      <Users className="mx-auto h-8 w-8 mb-2 opacity-30" />
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (data?.data ?? []).map((u: any) => (
                  <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{ROLE_LABEL[u.role] ?? u.role}</Badge></TableCell>
                    <TableCell>
                      <Badge variant={u.isActive ? "default" : "secondary"}>{u.isActive ? "Active" : "Inactive"}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(u.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground hover:text-foreground gap-1.5"
                        onClick={() => openSetPassword({ id: u.id, name: u.name })}
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                        Set Password
                      </Button>
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
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <span className="text-sm text-muted-foreground py-2">Page {page}</span>
          <Button variant="outline" size="sm" disabled={(page * 20) >= (data?.total ?? 0)} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}

      {/* Create User Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New User</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Full Name *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} data-testid="input-name" />
            </div>
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} data-testid="input-email" />
            </div>
            <div className="space-y-1.5">
              <Label>Password *</Label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} data-testid="input-password" />
            </div>
            <div className="space-y-1.5">
              <Label>Role *</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger data-testid="select-role"><SelectValue /></SelectTrigger>
                <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="button" onClick={handleCreate} disabled={createUser.isPending} data-testid="button-create-user">
              {createUser.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set Password Dialog */}
      <Dialog open={pwDialogOpen} onOpenChange={setPwDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              Set Password — {pwTarget?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>New Password</Label>
              <Input
                type={showPw ? "text" : "password"}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Minimum 6 characters"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Confirm Password</Label>
              <Input
                type={showPw ? "text" : "password"}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
              />
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                id="show-pw"
                checked={showPw}
                onChange={e => setShowPw(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="show-pw" className="cursor-pointer select-none">Show password</label>
            </div>
            {newPassword && confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-destructive">Passwords don't match</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPwDialogOpen(false)}>Cancel</Button>
            <Button
              type="button"
              onClick={handleSetPassword}
              disabled={setPasswordMutation.isPending || !newPassword || newPassword !== confirmPassword}
            >
              {setPasswordMutation.isPending ? "Saving..." : "Save Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
