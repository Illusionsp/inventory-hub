import { useState } from "react";
import {
  useListUsers,
  useCreateUser,
  useUpdateUser,
  useListStores,
  getListUsersQueryKey,
  getGetMeQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Users, KeyRound, Pencil, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ROLES = [
  "super_admin",
  "store_manager",
  "production_manager",
  "sales_officer",
  "finance_officer",
  "approver",
];

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  store_manager: "Store Manager",
  production_manager: "Production Manager",
  sales_officer: "Sales Officer",
  finance_officer: "Finance Officer",
  approver: "Approver",
};

// ── Permission definitions (mirrors lib/db/src/permissions.ts) ──────────────

const PERMISSION_LIST = [
  { key: "can_create_store_requests", label: "Create Store Requests", description: "Can create and dispatch store-to-store requests" },
  { key: "can_approve_requests", label: "Approve / Reject Requests", description: "Can approve or reject GRNs, transfers, and store requests" },
  { key: "can_receive_items", label: "Receive Items", description: "Can mark GRNs and store requests as received" },
  { key: "can_view_request_status", label: "View Request Status", description: "Can view status of all pending requests" },
  { key: "can_create_batch_production", label: "Create Production Batches", description: "Can start new production batch runs" },
  { key: "can_manage_inventory", label: "Manage Inventory", description: "Can add, edit, or adjust inventory stock levels" },
  { key: "can_view_reports", label: "View Reports & Analytics", description: "Can access sales reports and dashboard analytics" },
] as const;

const ROLE_DEFAULT_PERMISSIONS: Record<string, string[]> = {
  super_admin: PERMISSION_LIST.map(p => p.key),
  store_manager: ["can_create_store_requests", "can_receive_items", "can_view_request_status", "can_manage_inventory", "can_view_reports"],
  approver: ["can_approve_requests", "can_view_request_status", "can_view_reports"],
  production_manager: ["can_create_batch_production", "can_view_request_status", "can_view_reports"],
  finance_officer: ["can_view_reports", "can_view_request_status"],
  sales_officer: ["can_view_reports"],
};

/** Raw fetch that always includes the per-tab session Bearer token */
async function authedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = sessionStorage.getItem("tab_session");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  return fetch(url, { credentials: "include", ...init, headers: { ...headers, ...(init.headers as Record<string, string> | undefined ?? {}) } });
}

export default function UsersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === "super_admin";
  const [page, setPage] = useState(1);

  // ── Create user state ──────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [cName, setCName] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cPassword, setCPassword] = useState("");
  const [cRole, setCRole] = useState("sales_officer");
  const [cStoreId, setCStoreId] = useState("none");

  // ── Edit user state ────────────────────────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<{ id: number; name: string; role: string } | null>(null);
  const [eRole, setERole] = useState("sales_officer");
  const [eStoreId, setEStoreId] = useState("none");
  const [eIsActive, setEIsActive] = useState(true);
  /** true = stored as null in DB (use role defaults). false = explicit array saved. */
  const [eUseRoleDefaults, setEUseRoleDefaults] = useState(true);
  const [ePermissions, setEPermissions] = useState<string[]>([]);

  // ── Set password state ─────────────────────────────────────────────────────
  const [pwOpen, setPwOpen] = useState(false);
  const [pwTarget, setPwTarget] = useState<{ id: number; name: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  const { data, isLoading } = useListUsers({ page, limit: 20 });
  const { data: stores } = useListStores();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();

  const invalidateUsers = () => queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
  const invalidateMe = () => queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });

  // ── Set password mutation ──────────────────────────────────────────────────
  const setPasswordMutation = useMutation({
    mutationFn: async ({ id, password }: { id: number; password: string }) => {
      const res = await authedFetch(`/api/users/${id}/password`, {
        method: "PATCH",
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error ?? "Failed to set password");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Password updated", description: `Password changed for ${pwTarget?.name}` });
      setPwOpen(false);
      setPwTarget(null);
      setNewPassword("");
      setConfirmPassword("");
      setShowPw(false);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ── Helpers ────────────────────────────────────────────────────────────────
  const togglePermission = (key: string) => {
    setEPermissions(prev =>
      prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key],
    );
  };

  // When role changes in Edit dialog, reset permission selection to new role defaults
  const handleERoleChange = (newRole: string) => {
    setERole(newRole);
    if (eUseRoleDefaults) {
      setEPermissions(ROLE_DEFAULT_PERMISSIONS[newRole] ?? []);
    }
  };

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleCreate = () => {
    if (!cName || !cEmail || !cPassword || !cRole) {
      toast({ title: "Fill all required fields", variant: "destructive" });
      return;
    }
    createUser.mutate(
      {
        data: {
          name: cName,
          email: cEmail,
          password: cPassword,
          role: cRole,
          storeId: cStoreId !== "none" ? parseInt(cStoreId, 10) : undefined,
        } as any,
      },
      {
        onSuccess: () => {
          toast({ title: "User created" });
          setCreateOpen(false);
          setCName(""); setCEmail(""); setCPassword(""); setCRole("sales_officer"); setCStoreId("none");
          invalidateUsers();
        },
        onError: (e: any) =>
          toast({ title: "Failed to create user", description: e?.message, variant: "destructive" }),
      },
    );
  };

  const openEdit = (u: any) => {
    setEditTarget({ id: u.id, name: u.name, role: u.role ?? "sales_officer" });
    setERole(u.role ?? "sales_officer");
    setEStoreId(u.storeId ? String(u.storeId) : "none");
    setEIsActive(u.isActive ?? true);
    // u.permissions from the list is the raw stored value (null = role defaults)
    const hasCustomPerms = Array.isArray(u.permissions) && u.permissions.length > 0;
    setEUseRoleDefaults(!hasCustomPerms);
    setEPermissions(hasCustomPerms ? u.permissions : (ROLE_DEFAULT_PERMISSIONS[u.role] ?? []));
    setEditOpen(true);
  };

  const handleEdit = () => {
    if (!editTarget) return;
    const permissionsPayload = eUseRoleDefaults ? null : ePermissions;
    updateUser.mutate(
      {
        id: editTarget.id,
        data: {
          role: eRole,
          storeId: eStoreId !== "none" ? parseInt(eStoreId, 10) : null,
          isActive: eIsActive,
          permissions: permissionsPayload,
        } as any,
      },
      {
        onSuccess: () => {
          toast({ title: "User updated", description: `${editTarget.name} updated successfully` });
          setEditOpen(false);
          setEditTarget(null);
          invalidateUsers();
          if (editTarget.id === currentUser?.id) invalidateMe();
        },
        onError: (e: any) =>
          toast({ title: "Failed to update user", description: e?.message, variant: "destructive" }),
      },
    );
  };

  const openSetPassword = (u: { id: number; name: string }) => {
    setPwTarget(u);
    setNewPassword("");
    setConfirmPassword("");
    setShowPw(false);
    setPwOpen(true);
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage system users, roles, and permissions</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} data-testid="button-new-user">
          <Plus className="h-4 w-4 mr-2" />New User
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      <Users className="mx-auto h-8 w-8 mb-2 opacity-30" />
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (data?.data ?? []).map((u: any) => {
                  const isCustomPerms = Array.isArray(u.permissions) && u.permissions.length > 0;
                  return (
                    <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {ROLE_LABEL[u.role] ?? u.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {u.storeId ? (stores?.find((s: any) => s.id === u.storeId)?.name ?? `Store #${u.storeId}`) : "—"}
                      </TableCell>
                      <TableCell>
                        {u.role === "super_admin" ? (
                          <span className="text-xs text-muted-foreground">All (admin)</span>
                        ) : isCustomPerms ? (
                          <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                            Custom ({u.permissions.length})
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Role defaults</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.isActive ? "default" : "secondary"}>
                          {u.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-xs gap-1.5"
                            onClick={() => openEdit(u)}
                            data-testid={`button-edit-user-${u.id}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />Edit
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-xs text-muted-foreground hover:text-foreground gap-1.5"
                            onClick={() => openSetPassword({ id: u.id, name: u.name })}
                            data-testid={`button-set-password-${u.id}`}
                          >
                            <KeyRound className="h-3.5 w-3.5" />Password
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {(data?.total ?? 0) > 20 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground py-2">Page {page}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={(page * 20) >= (data?.total ?? 0)}
            onClick={() => setPage(p => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

      {/* ── Create User Dialog ─────────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New User</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Full Name *</Label>
              <Input value={cName} onChange={e => setCName(e.target.value)} data-testid="input-name" />
            </div>
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input type="email" value={cEmail} onChange={e => setCEmail(e.target.value)} data-testid="input-email" />
            </div>
            <div className="space-y-1.5">
              <Label>Password *</Label>
              <Input type="password" value={cPassword} onChange={e => setCPassword(e.target.value)} data-testid="input-password" />
            </div>
            <div className="space-y-1.5">
              <Label>Role *</Label>
              <Select value={cRole} onValueChange={setCRole}>
                <SelectTrigger data-testid="select-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Assigned Store</Label>
              <Select value={cStoreId} onValueChange={setCStoreId}>
                <SelectTrigger data-testid="select-store">
                  <SelectValue placeholder="No store" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No store assigned</SelectItem>
                  {(stores ?? []).map((s: any) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">Permissions will default to the selected role. You can customize them after creation.</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              type="button"
              onClick={handleCreate}
              disabled={createUser.isPending}
              data-testid="button-create-user"
            >
              {createUser.isPending ? "Creating..." : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit User Dialog ───────────────────────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User — {editTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Role *</Label>
              <Select value={eRole} onValueChange={handleERoleChange}>
                <SelectTrigger data-testid="select-edit-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Assigned Store</Label>
              <Select value={eStoreId} onValueChange={setEStoreId}>
                <SelectTrigger data-testid="select-edit-store">
                  <SelectValue placeholder="No store" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No store assigned</SelectItem>
                  {(stores ?? []).map((s: any) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Active Status</p>
                <p className="text-xs text-muted-foreground">Inactive users cannot log in</p>
              </div>
              <Switch
                checked={eIsActive}
                onCheckedChange={setEIsActive}
                data-testid="switch-active"
              />
            </div>

            {/* Permissions section — only super_admin can set; skip for super_admin targets */}
            {isSuperAdmin && eRole !== "super_admin" && (
              <div className="space-y-3 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Permissions</p>
                    <p className="text-xs text-muted-foreground">
                      {eUseRoleDefaults
                        ? "Using role defaults — toggle to set custom permissions"
                        : "Custom permissions — overrides role defaults"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant={eUseRoleDefaults ? "secondary" : "outline"}
                    size="sm"
                    className="text-xs gap-1.5 shrink-0"
                    onClick={() => {
                      const toDefaults = !eUseRoleDefaults;
                      setEUseRoleDefaults(toDefaults);
                      if (toDefaults) {
                        setEPermissions(ROLE_DEFAULT_PERMISSIONS[eRole] ?? []);
                      }
                    }}
                  >
                    <RotateCcw className="h-3 w-3" />
                    {eUseRoleDefaults ? "Role defaults" : "Reset to defaults"}
                  </Button>
                </div>

                <div className="space-y-2">
                  {PERMISSION_LIST.map(perm => (
                    <div
                      key={perm.key}
                      className={`flex items-start gap-3 rounded-md p-2 transition-colors ${
                        eUseRoleDefaults ? "opacity-60" : "hover:bg-accent/40"
                      }`}
                    >
                      <Checkbox
                        id={`perm-${perm.key}`}
                        checked={ePermissions.includes(perm.key)}
                        onCheckedChange={() => {
                          if (eUseRoleDefaults) {
                            // First toggle off role-defaults mode, then toggle this permission
                            setEUseRoleDefaults(false);
                          }
                          togglePermission(perm.key);
                        }}
                        className="mt-0.5"
                      />
                      <label
                        htmlFor={`perm-${perm.key}`}
                        className="cursor-pointer select-none space-y-0.5"
                      >
                        <p className="text-sm font-medium leading-none">{perm.label}</p>
                        <p className="text-xs text-muted-foreground">{perm.description}</p>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button
              type="button"
              onClick={handleEdit}
              disabled={updateUser.isPending}
              data-testid="button-save-user"
            >
              {updateUser.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Set Password Dialog ────────────────────────────────────────────── */}
      <Dialog open={pwOpen} onOpenChange={setPwOpen}>
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
                data-testid="input-new-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Confirm Password</Label>
              <Input
                type={showPw ? "text" : "password"}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                data-testid="input-confirm-password"
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
            <Button type="button" variant="outline" onClick={() => setPwOpen(false)}>Cancel</Button>
            <Button
              type="button"
              onClick={handleSetPassword}
              disabled={setPasswordMutation.isPending || !newPassword || newPassword !== confirmPassword}
              data-testid="button-save-password"
            >
              {setPasswordMutation.isPending ? "Saving..." : "Save Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
