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
import { useEffect } from "react";
import React from 'react';

// Add top-level error boundary
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('React error boundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-md w-full space-y-4">
            <h1 className="text-2xl font-bold text-red-600">Something went wrong</h1>
            <pre className="text-sm bg-gray-100 p-4 rounded overflow-auto">
              {this.state.error?.toString()}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function Router() {
  console.log('Router component rendering');

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
  console.log('App component rendering');

  useEffect(() => {
    console.log('App component mounted');
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Router />
          <Toaster />
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;