import { AuthProvider } from "@/hooks/use-auth";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import SharePage from "@/pages/share-page";
import CustomizePage from "@/pages/customize-page";
import VerifyEmailPage from "@/pages/verify-email";
import AdminDashboard from "@/pages/admin-dashboard";
import { ProtectedRoute } from "./lib/protected-route";
import ProfilePage from "@/pages/profile";

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} path="/" />} />
      <Route path="/profile" component={() => <ProtectedRoute component={ProfilePage} path="/profile" />} />
      <Route 
        path="/customize/:id" 
        component={({ params }) => (
          <ProtectedRoute 
            component={() => <CustomizePage params={params} />} 
            path="/customize/:id" 
          />
        )} 
      />
      <Route 
        path="/customize-template/:id" 
        component={({ params }) => (
          <ProtectedRoute 
            component={() => <CustomizePage params={params} isTemplate={true} />} 
            path="/customize-template/:id" 
          />
        )} 
      />
      <Route 
        path="/admin" 
        component={() => (
          <ProtectedRoute 
            component={AdminDashboard} 
            path="/admin"
            requireAdmin={true}
          />
        )}
      />
      <Route path="/p/:slug" component={SharePage} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/auth/verify" component={VerifyEmailPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;