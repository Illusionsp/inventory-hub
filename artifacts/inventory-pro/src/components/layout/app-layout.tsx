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
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const navItems = [
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
      { title: "Stock Levels", icon: Package, url: "/inventory" },
      { title: "Movements", icon: ArrowRightLeft, url: "/inventory/movements" },
      { title: "Production Batches", icon: Factory, url: "/production" },
      { title: "Store Transfers", icon: Box, url: "/transfers" },
      { title: "Goods Receiving", icon: ClipboardList, url: "/grn" },
    ],
  },
  {
    title: "Sales & Customers",
    items: [
      { title: "Sales Invoices", icon: ShoppingCart, url: "/sales" },
      { title: "Payments", icon: CreditCard, url: "/payments" },
      { title: "Customers", icon: Users, url: "/customers" },
    ],
  },
  {
    title: "Master Data",
    items: [
      { title: "Products", icon: Package, url: "/products" },
      { title: "Categories", icon: Box, url: "/categories" },
      { title: "Suppliers", icon: Store, url: "/suppliers" },
    ],
  },
  {
    title: "Administration",
    items: [
      { title: "Stores", icon: Store, url: "/stores" },
      { title: "Users", icon: Users, url: "/users", role: "super_admin" },
      { title: "Audit Log", icon: FileText, url: "/audit", role: "super_admin" },
    ],
  },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [location] = useLocation();
  const queryClient = useQueryClient();
  const logoutMutation = useLogout({
    mutation: {
      onSuccess: () => {
        queryClient.clear();
        window.location.href = "/login";
      },
    },
  });

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar className="border-r border-sidebar-border bg-sidebar">
          <SidebarHeader className="p-4">
            <div className="flex items-center gap-2 px-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold">
                M
              </div>
              <span className="text-lg font-bold tracking-tight text-sidebar-foreground">
                Inventory Pro
              </span>
            </div>
          </SidebarHeader>
          <SidebarContent>
            {navItems.map((group) => {
              const visibleItems = group.items.filter(
                (item) => !item.role || item.role === user?.role
              );

              if (visibleItems.length === 0) return null;

              return (
                <SidebarGroup key={group.title}>
                  <SidebarGroupLabel className="text-sidebar-foreground/60 text-xs font-semibold uppercase tracking-wider">
                    {group.title}
                  </SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {visibleItems.map((item) => (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton
                            asChild
                            isActive={location.startsWith(item.url)}
                            tooltip={item.title}
                          >
                            <Link href={item.url} className="flex items-center gap-3">
                              <item.icon className="h-4 w-4" />
                              <span>{item.title}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              );
            })}
          </SidebarContent>
          <SidebarFooter className="p-4">
            <div className="flex items-center justify-between rounded-lg bg-sidebar-accent/50 p-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/20 text-primary text-xs">
                    {user?.name?.substring(0, 2).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-sidebar-foreground">
                    {user?.name}
                  </span>
                  <span className="text-xs text-sidebar-foreground/60 capitalize">
                    {user?.role?.replace("_", " ")}
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-sidebar-foreground/60 hover:text-destructive hover:bg-destructive/10"
                onClick={() => logoutMutation.mutate()}
                title="Log out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="h-14 border-b bg-card flex items-center px-4 shrink-0">
            <SidebarTrigger className="mr-4" />
            <div className="flex-1" />
          </header>
          <div className="flex-1 overflow-auto p-6 lg:p-8">
            <div className="mx-auto max-w-7xl w-full">
              {children}
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
