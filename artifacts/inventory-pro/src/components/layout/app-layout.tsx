import React from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  BarChart2,
  Bell,
  Box,
  ClipboardList,
  CreditCard,
  Factory,
  FileText,
  LogOut,
  Package,
  Settings,
  ShoppingCart,
  Store,
  Users,
  SendHorizonal,
  PackagePlus,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Role = string;

interface NavItem {
  title: string;
  icon: React.ElementType;
  url: string;
  roles?: Role[];
  /** Extra path prefixes that should also mark this item active */
  activeFor?: string[];
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const ALL_ROLES = ["super_admin", "store_manager", "finance", "approver", "sales_officer", "accountant"];

const navGroups: NavGroup[] = [
  {
    title: "Overview",
    items: [
      { title: "Dashboard", icon: Activity, url: "/dashboard" },
      { title: "Notifications", icon: Bell, url: "/notifications" },
    ],
  },
  {
    title: "Inventory & Production",
    items: [
      { title: "Opening Stock", icon: PackagePlus, url: "/opening-stock", roles: ["super_admin", "store_manager"] },
      { title: "Stock Levels", icon: Package, url: "/inventory", roles: ["super_admin", "store_manager", "approver"] },
      { title: "Movements", icon: ArrowRightLeft, url: "/inventory/movements", roles: ["super_admin", "store_manager"] },
      { title: "Production Batches", icon: Factory, url: "/production", roles: ["super_admin", "store_manager"] },
      { title: "Requesting", icon: SendHorizonal, url: "/store-requests", activeFor: ["/transfers"], roles: ["super_admin", "store_manager", "approver"] },
      { title: "Goods Receiving", icon: ClipboardList, url: "/grn", roles: ["super_admin", "store_manager", "approver", "finance", "accountant"] },
    ],
  },
  {
    title: "Sales & Customers",
    items: [
      { title: "Sales Invoices", icon: ShoppingCart, url: "/sales", roles: ["super_admin", "finance", "sales_officer", "accountant"] },
      { title: "Sales Report", icon: BarChart2, url: "/sales/report", roles: ["super_admin", "finance", "sales_officer", "accountant"] },
      { title: "Payments", icon: CreditCard, url: "/payments", roles: ["super_admin", "finance", "accountant"] },
      { title: "Customers", icon: Users, url: "/customers", roles: ["super_admin", "finance", "sales_officer", "accountant"] },
    ],
  },
  {
    title: "Master Data",
    items: [
      { title: "Products", icon: Package, url: "/products", roles: ["super_admin", "store_manager"] },
      { title: "Categories", icon: Box, url: "/categories", roles: ["super_admin", "store_manager"] },
      { title: "Suppliers", icon: Store, url: "/suppliers", roles: ["super_admin", "store_manager", "finance", "accountant"] },
    ],
  },
  {
    title: "Administration",
    items: [
      { title: "Stores", icon: Store, url: "/stores", roles: ["super_admin"] },
      { title: "Users", icon: Users, url: "/users", roles: ["super_admin"] },
      { title: "Audit Log", icon: FileText, url: "/audit", roles: ["super_admin"] },
    ],
  },
];

const ROLE_BADGE_COLORS: Record<string, string> = {
  super_admin: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  store_manager: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  finance: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  approver: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  sales_officer: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
  accountant: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
};

function canAccess(itemRoles: Role[] | undefined, userRole: string): boolean {
  if (!itemRoles) return true;
  return itemRoles.includes(userRole);
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [location] = useLocation();
  const queryClient = useQueryClient();
  const logoutMutation = useLogout({
    mutation: {
      onSuccess: () => {
        // Clear this tab's session token so the bearer header is gone
        // before we redirect — the next page load starts fresh.
        sessionStorage.removeItem("tab_session");
        queryClient.clear();
        window.location.href = "/login";
      },
    },
  });

  const userRole = user?.role || "sales_officer";

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar className="border-r border-sidebar-border bg-sidebar">
          <SidebarHeader className="p-4 border-b border-sidebar-border/50">
            <div className="flex items-center gap-3 px-1">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground font-bold text-base shadow-sm">
                M
              </div>
              <div>
                <span className="text-base font-bold tracking-tight text-sidebar-foreground">
                  RAFLOS Softwares
                </span>
                <p className="text-xs text-sidebar-foreground/50 leading-none mt-0.5">Multi-Store</p>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent className="py-2">
            {navGroups.map((group) => {
              const visibleItems = group.items.filter((item) =>
                canAccess(item.roles, userRole)
              );
              if (visibleItems.length === 0) return null;

              return (
                <SidebarGroup key={group.title}>
                  <SidebarGroupLabel className="text-sidebar-foreground/40 text-[10px] font-bold uppercase tracking-widest px-4 mb-1">
                    {group.title}
                  </SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {visibleItems.map((item) => {
                        const isActive =
                          location === item.url ||
                          location.startsWith(item.url + "/") ||
                          (item.activeFor ?? []).some(p => location === p || location.startsWith(p + "/"));
                        return (
                          <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton
                              asChild
                              isActive={isActive}
                              tooltip={item.title}
                            >
                              <Link
                                href={item.url}
                                className="flex items-center gap-3 px-3 py-2 rounded-lg"
                              >
                                <item.icon className="h-4 w-4 shrink-0" />
                                <span className="text-sm">{item.title}</span>
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              );
            })}
          </SidebarContent>

          <SidebarFooter className="p-3 border-t border-sidebar-border/50">
            <div className="flex items-center justify-between rounded-xl bg-sidebar-accent/60 p-3">
              <div className="flex items-center gap-2.5">
                <Avatar className="h-8 w-8 border border-sidebar-border/50">
                  <AvatarFallback className="bg-sidebar-primary/20 text-sidebar-primary text-xs font-semibold">
                    {user?.name?.substring(0, 2).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-semibold text-sidebar-foreground truncate leading-tight">
                    {user?.name}
                  </span>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-0.5 w-fit capitalize ${ROLE_BADGE_COLORS[userRole] || "bg-sidebar-accent text-sidebar-foreground"}`}>
                    {userRole.replace(/_/g, " ")}
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-sidebar-foreground/50 hover:text-destructive hover:bg-destructive/10"
                onClick={() => logoutMutation.mutate()}
                title="Log out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="h-14 border-b bg-card flex items-center px-4 shrink-0 gap-3">
            <SidebarTrigger className="mr-2" />
            <div className="flex-1" />
            <span className="text-xs text-muted-foreground hidden sm:block">
              {new Date().toLocaleDateString("en-ET", { weekday: "short", year: "numeric", month: "short", day: "numeric" })}
            </span>
          </header>
          <div className="flex-1 overflow-auto">
            <div className="mx-auto max-w-7xl w-full p-4 md:p-6">
              {children}
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
