import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AppLayout } from "@/components/layout/app-layout";
import { PosLayout } from "@/components/layout/pos-layout";
import NotFound from "@/pages/not-found";

import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Inventory from "@/pages/inventory/index";
import InventoryMovements from "@/pages/inventory/movements";
import Products from "@/pages/products/index";
import Categories from "@/pages/categories/index";
import Suppliers from "@/pages/suppliers/index";
import Customers from "@/pages/customers/index";
import CustomerStatement from "@/pages/customers/statement";
import GrnList from "@/pages/grn/index";
import GrnNew from "@/pages/grn/new";
import GrnDetail from "@/pages/grn/detail";
import TransferNew from "@/pages/transfers/new";
import TransferDetail from "@/pages/transfers/detail";
import RequestingPage from "@/pages/store-requests/index";
import StoreRequestNew from "@/pages/store-requests/new";
import StoreRequestDetail from "@/pages/store-requests/detail";
import ProductionList from "@/pages/production/index";
import ProductionNew from "@/pages/production/new";
import ProductionDetail from "@/pages/production/detail";
import WastageReport from "@/pages/production/wastage-report";
import SalesList from "@/pages/sales/index";
import SalesNew from "@/pages/sales/new";
import SaleDetail from "@/pages/sales/detail";
import SalesReport from "@/pages/sales/report";
import Payments from "@/pages/payments/index";
import Users from "@/pages/users/index";
import Stores from "@/pages/stores/index";
import Notifications from "@/pages/notifications/index";
import AuditLogs from "@/pages/audit/index";
import OpeningStock from "@/pages/opening-stock/index";

/**
 * When a mutation (write operation) returns 401, it means the user's session
 * expired mid-flight. Clear the stale token and redirect to login — but only
 * if the tab actually had a token (i.e. was previously logged in). If there
 * was no token the AuthProvider / ProtectedRoute already handles the redirect,
 * and we must not interfere with another tab that is still authenticated.
 */
function onMutation401(error: unknown) {
  if ((error as any)?.status === 401) {
    const hadToken = !!sessionStorage.getItem("tab_session");
    sessionStorage.removeItem("tab_session");
    const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
    if (hadToken && !window.location.pathname.endsWith("/login")) {
      window.location.replace(`${base}/login`);
    }
  }
}

const queryClient = new QueryClient({
  // Only intercept mutation (write) 401s. Query 401s are handled by
  // AuthProvider + ProtectedRoute, which already redirect to /login cleanly.
  mutationCache: new MutationCache({ onError: onMutation401 }),
  defaultOptions: {
    queries: {
      // Never retry auth failures — detect session expiry immediately so
      // ProtectedRoute can redirect without a multi-second retry delay.
      retry: (failureCount, error) =>
        (error as any)?.status === 401 ? false : failureCount < 1,
      staleTime: 30000,
    },
  },
});

function ProtectedRoute({ component: Component, ...rest }: { component: React.ComponentType<any>;[key: string]: any }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return (
    <AppLayout>
      <Component {...rest} />
    </AppLayout>
  );
}

function PosProtectedRoute({ component: Component, ...rest }: { component: React.ComponentType<any>;[key: string]: any }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <Redirect to="/login" />;

  return (
    <PosLayout>
      <Component {...rest} />
    </PosLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/">
        <Redirect to="/dashboard" />
      </Route>
      <Route path="/dashboard">{() => <ProtectedRoute component={Dashboard} />}</Route>
      <Route path="/inventory">{() => <ProtectedRoute component={Inventory} />}</Route>
      <Route path="/inventory/movements">{() => <ProtectedRoute component={InventoryMovements} />}</Route>
      <Route path="/products">{() => <ProtectedRoute component={Products} />}</Route>
      <Route path="/categories">{() => <ProtectedRoute component={Categories} />}</Route>
      <Route path="/suppliers">{() => <ProtectedRoute component={Suppliers} />}</Route>
      <Route path="/customers">{() => <ProtectedRoute component={Customers} />}</Route>
      <Route path="/customers/:id/statement">{(params) => <ProtectedRoute component={CustomerStatement} id={params.id} />}</Route>
      <Route path="/grn">{() => <ProtectedRoute component={GrnList} />}</Route>
      <Route path="/grn/new">{() => <ProtectedRoute component={GrnNew} />}</Route>
      <Route path="/grn/:id">{(params) => <ProtectedRoute component={GrnDetail} id={params.id} />}</Route>
      <Route path="/store-requests">{() => <ProtectedRoute component={RequestingPage} />}</Route>
      <Route path="/transfers">{() => <ProtectedRoute component={RequestingPage} />}</Route>
      <Route path="/store-requests/new">{() => <ProtectedRoute component={StoreRequestNew} />}</Route>
      <Route path="/store-requests/:id">{(params) => <ProtectedRoute component={StoreRequestDetail} id={params.id} />}</Route>
      <Route path="/transfers/new">{() => <ProtectedRoute component={TransferNew} />}</Route>
      <Route path="/transfers/:id">{(params) => <ProtectedRoute component={TransferDetail} id={params.id} />}</Route>
      <Route path="/production">{() => <ProtectedRoute component={ProductionList} />}</Route>
      <Route path="/production/wastage">{() => <ProtectedRoute component={WastageReport} />}</Route>
      <Route path="/production/new">{() => <ProtectedRoute component={ProductionNew} />}</Route>
      <Route path="/production/:id">{(params) => <ProtectedRoute component={ProductionDetail} id={params.id} />}</Route>

      {/* Admin/Manager Sales Namespace */}
      <Route path="/sales">{() => <ProtectedRoute component={SalesList} />}</Route>
      <Route path="/sales/report">{() => <ProtectedRoute component={SalesReport} />}</Route>
      <Route path="/sales/new">{() => <ProtectedRoute component={SalesNew} />}</Route>
      <Route path="/sales/:id">{(params) => <ProtectedRoute component={SaleDetail} id={params.id} />}</Route>

      {/* Point of Sale (POS) Namespace for Sales Officers */}
      <Route path="/pos">{() => <PosProtectedRoute component={SalesList} />}</Route>
      <Route path="/pos/report">{() => <PosProtectedRoute component={SalesReport} />}</Route>
      <Route path="/pos/new">{() => <PosProtectedRoute component={SalesNew} />}</Route>
      <Route path="/pos/:id">{(params) => <PosProtectedRoute component={SaleDetail} id={params.id} />}</Route>

      <Route path="/payments">{() => <ProtectedRoute component={Payments} />}</Route>
      <Route path="/users">{() => <ProtectedRoute component={Users} />}</Route>
      <Route path="/stores">{() => <ProtectedRoute component={Stores} />}</Route>
      <Route path="/notifications">{() => <ProtectedRoute component={Notifications} />}</Route>
      <Route path="/audit">{() => <ProtectedRoute component={AuditLogs} />}</Route>
      <Route path="/opening-stock">{() => <ProtectedRoute component={OpeningStock} />}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
