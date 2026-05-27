import React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, isLoading: isAuthLoading } = useAuth();

  // Redirect to dashboard once we know the user is already logged in.
  // isAuthLoading is true until the first /auth/me response lands, so this
  // effect only fires after the session is confirmed — not on the initial render.
  React.useEffect(() => {
    if (!isAuthLoading && user) {
      setLocation("/dashboard");
    }
  }, [user, isAuthLoading, setLocation]);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    // Empty defaults — do not pre-fill credentials.
    // autoComplete attributes on the inputs handle browser password manager behaviour.
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const loginMutation = useLogin({
    mutation: {
      onSuccess: (data) => {
        // Store this tab's own session token in sessionStorage (tab-scoped),
        // so the bearer header keeps this tab's identity independent of the
        // shared cookie that other tabs use.
        if (data?.token) {
          sessionStorage.setItem("tab_session", data.token);
        }
        queryClient.invalidateQueries();
        setLocation("/dashboard");
      },
      onError: () => {
        toast({
          title: "Login failed",
          description: "Invalid email or password. Please try again.",
          variant: "destructive",
        });
      },
    },
  });

  function onSubmit(values: z.infer<typeof loginSchema>) {
    loginMutation.mutate({ data: values });
  }

  // Show the form during the initial auth check so the user never sees a blank
  // screen.  If they are already logged in the useEffect above will redirect
  // to /dashboard as soon as the check completes.
  if (user) return null;

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-background">
      {/* Left side - branding */}
      <div className="hidden lg:flex flex-1 flex-col justify-between bg-sidebar p-12 text-sidebar-foreground border-r border-sidebar-border">
        <div>
          <div className="flex items-center gap-3 mb-12">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xl">
              M
            </div>
            <span className="text-2xl font-bold tracking-tight">
              RAFLOS Softwares
            </span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-4 max-w-md">
            Precision operations for modern manufacturing.
          </h1>
          <p className="text-sidebar-foreground/70 text-lg max-w-md">
            Track every gram of material from raw purchase to finished product sale.
          </p>
        </div>
        <div className="text-sm text-sidebar-foreground/50">
          &copy; {new Date().getFullYear()} RAFLOS Softwares. All rights reserved.
        </div>
      </div>

      {/* Right side - login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center lg:text-left space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">Welcome back</h2>
            <p className="text-muted-foreground">
              Enter your credentials to access your account
            </p>
          </div>

          <Form {...form}>
            {/*
              autoComplete="off" on the form suppresses browser form autofill.
              Individual inputs carry specific values so password managers can
              still offer to save credentials after a successful login, but will
              not pre-fill on page load.
            */}
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-6"
              autoComplete="off"
            >
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="Enter your email"
                        autoComplete="username"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Enter your password"
                        autoComplete="current-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          </Form>

          <div className="rounded-md bg-muted p-4 text-sm text-muted-foreground">
            <p className="font-medium mb-1 text-foreground">Demo Accounts:</p>
            <ul className="space-y-1 font-mono text-xs">
              <li>admin@inventorypro.com / admin123</li>
              <li>manager@inventorypro.com / manager123</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
