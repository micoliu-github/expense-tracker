import { Switch, Route } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider, useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AppSidebar } from "@/components/AppSidebar";
import Dashboard from "@/pages/Dashboard";
import MonthlyEntry from "@/pages/MonthlyEntry";
import FixedExpenses from "@/pages/FixedExpenses";
import FoodSettings from "@/pages/FoodSettings";
import Savings from "@/pages/Savings";
import Grocery from "@/pages/Grocery";
import Documentation from "@/pages/Documentation";
import Login from "@/pages/Login";
import NotFound from "@/pages/not-found";
import PerplexityAttribution from "@/components/PerplexityAttribution";
import { useState } from "react";

function AppLayout({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-background">
      <AppSidebar onLogout={onLogout} />
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <Switch hook={useHashLocation}>
          <Route path="/" component={Dashboard} />
          <Route path="/entry" component={MonthlyEntry} />
          <Route path="/entry/:month" component={MonthlyEntry} />
          <Route path="/fixed" component={FixedExpenses} />
          <Route path="/food-settings" component={FoodSettings} />
          <Route path="/savings" component={Savings} />
          <Route path="/grocery" component={Grocery} />
          <Route path="/docs" component={Documentation} />
          <Route component={NotFound} />
        </Switch>
        <PerplexityAttribution />
      </main>
    </div>
  );
}

function AuthGate() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  // Check session on mount
  useQuery({
    queryKey: ["/api/auth/check"],
    queryFn: async () => {
      const res = await fetch("/api/auth/check");
      const data = await res.json();
      setAuthed(data.authenticated === true);
      return data;
    },
    staleTime: Infinity,
    retry: false,
  });

  const logoutMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/auth/logout", {}),
    onSuccess: () => {
      queryClient.clear();
      setAuthed(false);
    },
  });

  // Still checking session
  if (authed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }

  if (!authed) {
    return <Login onSuccess={() => setAuthed(true)} />;
  }

  return <AppLayout onLogout={() => logoutMutation.mutate()} />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthGate />
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
