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
import { ProtectedRoute } from "./lib/protected-route";

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} path="/" />} />
      <Route 
        path="/customize/:id" 
        component={({ params }) => (
          <ProtectedRoute 
            component={() => <CustomizePage params={params} />} 
            path="/customize/:id" 
          />
        )} 
      />
      <Route path="/p/:slug" component={SharePage} />
      <Route path="/auth" component={AuthPage} />
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