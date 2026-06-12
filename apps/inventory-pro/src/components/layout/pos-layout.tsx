import React from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, ShoppingCart, BarChart2, PlusCircle, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function PosLayout({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [location] = useLocation();
    const queryClient = useQueryClient();
    const logoutMutation = useLogout({
        mutation: {
            onSuccess: () => {
                sessionStorage.removeItem("tab_session");
                queryClient.clear();
                window.location.href = "/login";
            },
        },
    });

    const navItems = [
        { title: "New Sale", icon: PlusCircle, url: "/pos/new" },
        { title: "Recent Sales", icon: ShoppingCart, url: "/pos" },
        { title: "Sales Report", icon: BarChart2, url: "/pos/report" },
        // Only show dashboard link if they have reports permission or similar? Actually, let them go back to main if they want.
        { title: "Main App", icon: Activity, url: "/dashboard" },
    ];

    return (
        <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-zinc-950">
            {/* Top Header */}
            <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-white dark:bg-zinc-900 px-4 md:px-6 shadow-sm shrink-0">
                <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
                        FS
                    </div>
                    <span className="font-bold text-lg hidden sm:inline-block tracking-tight">Sales POS</span>
                </div>

                <nav className="hidden md:flex ml-6 flex-1 gap-1">
                    {navItems.map((item) => {
                        const isActive = location === item.url || (item.url !== "/pos" && location.startsWith(item.url + "/"));
                        return (
                            <Button
                                key={item.title}
                                variant={isActive ? "secondary" : "ghost"}
                                className={`gap-2 ${isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground"}`}
                                asChild
                            >
                                <Link href={item.url}>
                                    <item.icon className="h-4 w-4" />
                                    {item.title}
                                </Link>
                            </Button>
                        );
                    })}
                </nav>

                <div className="flex-1 md:hidden" />

                <div className="flex items-center gap-4">
                    <div className="hidden sm:flex flex-col items-end">
                        <span className="text-sm font-semibold leading-none">{user?.name}</span>
                        <span className="text-xs text-muted-foreground mt-1 capitalize">{user?.role?.replace(/_/g, " ")}</span>
                    </div>
                    <Avatar className="h-9 w-9 border">
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                            {user?.name?.substring(0, 2).toUpperCase() || "U"}
                        </AvatarFallback>
                    </Avatar>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => logoutMutation.mutate()}
                        title="Log out"
                    >
                        <LogOut className="h-5 w-5" />
                    </Button>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
                <div className="mx-auto max-w-7xl w-full">
                    {children}
                </div>
            </main>

            {/* Mobile Nav */}
            <div className="md:hidden sticky bottom-0 z-30 flex items-center justify-between border-t bg-white dark:bg-zinc-900 px-4 py-3 shrink-0 pb-safe">
                {navItems.slice(0, 3).map((item) => {
                    const isActive = location === item.url || (item.url !== "/pos" && location.startsWith(item.url + "/"));
                    return (
                        <Link key={item.title} href={item.url} className={`flex flex-col items-center gap-1 min-w-[70px] ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                            <item.icon className="h-5 w-5" />
                            <span className="text-[10px] font-medium">{item.title}</span>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
