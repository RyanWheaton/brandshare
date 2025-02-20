import { createContext, ReactNode, useContext, useRef, useEffect } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { insertUserSchema, User as SelectUser, InsertUser } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AuthContextType = {
  user: SelectUser | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<SelectUser, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<SelectUser, Error, InsertUser>;
};

type LoginData = Pick<InsertUser, "email" | "password">;

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const abortControllerRef = useRef<AbortController | null>(null);

  // Set up abort controller
  useEffect(() => {
    if (!abortControllerRef.current) {
      abortControllerRef.current = new AbortController();
    }

    return () => {
      if (abortControllerRef.current) {
        console.log("Aborting pending auth API requests...");
        abortControllerRef.current.abort();
        // Don't set to null, just leave the aborted controller
      }
    };
  }, []);

  const {
    data: user,
    error,
    isLoading,
  } = useQuery<SelectUser | null, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    gcTime: 0,
  });

  const loginMutation = useMutation<SelectUser, Error, LoginData>({
    mutationFn: async (credentials: LoginData) => {
      try {
        if (!abortControllerRef.current) {
          abortControllerRef.current = new AbortController();
        }
        const res = await apiRequest(
          "POST", 
          "/api/login", 
          credentials,
          abortControllerRef.current.signal
        );
        const data = await res.json();
        if (!data) throw new Error("No data received from login");
        return data;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          console.log("Login request aborted");
          throw error; // Rethrow abort error to be handled by onError
        }
        throw error;
      }
    },
    onSuccess: (user: SelectUser) => {
      queryClient.setQueryData(["/api/user"], user);
    },
    onError: (error: Error) => {
      if (error instanceof DOMException && error.name === "AbortError") {
        console.log("Login aborted");
        return;
      }
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation<SelectUser, Error, InsertUser>({
    mutationFn: async (credentials: InsertUser) => {
      try {
        if (!abortControllerRef.current) {
          abortControllerRef.current = new AbortController();
        }
        const res = await apiRequest(
          "POST", 
          "/api/register", 
          credentials,
          abortControllerRef.current.signal
        );
        const data = await res.json();
        if (!data) throw new Error("No data received from registration");
        return data;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          console.log("Register request aborted");
          throw error; // Rethrow abort error to be handled by onError
        }
        throw error;
      }
    },
    onSuccess: (user: SelectUser) => {
      queryClient.setQueryData(["/api/user"], user);
    },
    onError: (error: Error) => {
      if (error instanceof DOMException && error.name === "AbortError") {
        console.log("Registration aborted");
        return;
      }
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation<void, Error, void>({
    mutationFn: async () => {
      try {
        if (!abortControllerRef.current) {
          abortControllerRef.current = new AbortController();
        }
        await apiRequest(
          "POST", 
          "/api/logout", 
          undefined,
          abortControllerRef.current.signal
        );
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          console.log("Logout request aborted");
          throw error; // Rethrow abort error to be handled by onError
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
    },
    onError: (error: Error) => {
      if (error instanceof DOMException && error.name === "AbortError") {
        console.log("Logout aborted");
        return;
      }
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}