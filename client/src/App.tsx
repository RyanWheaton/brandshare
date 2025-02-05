
import { Route, Switch } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import SharePage from "@/pages/share-page";
import CustomizePage from "@/pages/customize-page";
import NotFound from "@/pages/not-found";
import ProtectedRoute from "@/lib/protected-route";

export default function App() {
  return (
    <>
      <Switch>
        <Route path="/auth" component={AuthPage} />
        <Route path="/" component={() => (
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        )} />
        <Route path="/customize/:id" component={() => (
          <ProtectedRoute>
            <CustomizePage params={{ id: window.location.pathname.split('/')[2] }} />
          </ProtectedRoute>
        )} />
        <Route path="/p/:slug" component={SharePage} />
        <Route component={NotFound} />
      </Switch>
      <Toaster />
    </>
  );
}
