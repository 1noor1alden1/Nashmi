import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AppLayout, AuthGuard } from "@/components/layout";
import AuthPage from "@/pages/auth";
import HomePage from "@/pages/home";
import CreateServicePage from "@/pages/create-service";
import ServiceDetailPage from "@/pages/service-detail";
import DashboardPage from "@/pages/dashboard";
import LeaderboardPage from "@/pages/leaderboard";
import NotFound from "@/pages/not-found";
import ProfilePage from "@/pages/profile";
import AdminDisputesPage from "@/pages/admin-disputes";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      
      {/* Protected Routes wrapped in Layout */}
      <Route path="/">
        <AuthGuard>
          <AppLayout>
            <HomePage />
          </AppLayout>
        </AuthGuard>
      </Route>
      
      <Route path="/services/new">
        <AuthGuard>
          <AppLayout>
            <CreateServicePage />
          </AppLayout>
        </AuthGuard>
      </Route>
      
      <Route path="/services/:id">
        <AuthGuard>
          <AppLayout>
            <ServiceDetailPage />
          </AppLayout>
        </AuthGuard>
      </Route>
      
      <Route path="/dashboard">
        <AuthGuard>
          <AppLayout>
            <DashboardPage />
          </AppLayout>
        </AuthGuard>
      </Route>
      
      <Route path="/leaderboard">
        <AuthGuard>
          <AppLayout>
            <LeaderboardPage />
          </AppLayout>
        </AuthGuard>
      </Route>
      
      <Route path="/profile/me"><AuthGuard><AppLayout><ProfilePage /></AppLayout></AuthGuard></Route>
      <Route path="/admin/disputes"><AuthGuard><AppLayout><AdminDisputesPage /></AppLayout></AuthGuard></Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
