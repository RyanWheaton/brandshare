import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, KeyRound, Trash2, FileText, HardDrive } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useState, useRef, useEffect } from "react";

interface UserStats {
  id: number;
  email: string;
  username: string;
  totalSharePages: number;
  totalFiles: number;
  totalStorage: number;
  emailVerified: boolean;
}

export default function AdminDashboard() {
  const { toast } = useToast();
  const [resetPasswordUserId, setResetPasswordUserId] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);

  // Set up abort controller
  useEffect(() => {
    // Create a new controller for this component instance
    abortControllerRef.current = new AbortController();

    return () => {
      if (abortControllerRef.current) {
        console.log("Aborting pending admin API requests...");
        abortControllerRef.current.abort();
        // Create a new controller after aborting
        abortControllerRef.current = new AbortController();
      }
    };
  }, []);

  const { data: users, isLoading } = useQuery<UserStats[]>({
    queryKey: ["/api/admin/users"],
    retry: false,
    gcTime: 0,
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, password }: { userId: number; password: string }) => {
      // Ensure we have a valid controller
      if (!abortControllerRef.current || abortControllerRef.current.signal.aborted) {
        abortControllerRef.current = new AbortController();
      }

      try {
        const response = await apiRequest(
          "POST",
          `/api/admin/users/${userId}/reset-password`,
          { newPassword: password },
          abortControllerRef.current.signal
        );
        return response.json();
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          console.log("Reset password request aborted");
          return null;
        }
        throw error;
      }
    },
    onSuccess: (data) => {
      if (data === null) return; // Skip if request was aborted
      toast({
        title: "Success",
        description: "Password has been reset successfully",
      });
      setResetPasswordUserId(null);
      setNewPassword("");
    },
    onError: (error: Error) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      // Ensure we have a valid controller
      if (!abortControllerRef.current || abortControllerRef.current.signal.aborted) {
        abortControllerRef.current = new AbortController();
      }

      try {
        const response = await apiRequest(
          "DELETE",
          `/api/admin/users/${userId}`,
          undefined,
          abortControllerRef.current.signal
        );
        return response.json();
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          console.log("Delete user request aborted");
          return null;
        }
        throw error;
      }
    },
    onSuccess: (data) => {
      if (data === null) return; // Skip if request was aborted
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: "User has been deleted successfully",
      });
    },
    onError: (error: Error) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleResetPassword = () => {
    if (!resetPasswordUserId || !newPassword) return;
    resetPasswordMutation.mutate({ userId: resetPasswordUserId, password: newPassword });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Verified</TableHead>
              <TableHead className="text-right">Share Pages</TableHead>
              <TableHead className="text-right">Total Files</TableHead>
              <TableHead className="text-right">Storage (MB)</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users?.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.username}</TableCell>
                <TableCell>{user.emailVerified ? "Yes" : "No"}</TableCell>
                <TableCell className="text-right">{user.totalSharePages}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    {user.totalFiles}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <HardDrive className="h-4 w-4 text-muted-foreground" />
                    {user.totalStorage}
                  </div>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Dialog
                    open={resetPasswordUserId === user.id}
                    onOpenChange={(open) => {
                      if (!open) setResetPasswordUserId(null);
                      setNewPassword("");
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setResetPasswordUserId(user.id)}
                      >
                        <KeyRound className="h-4 w-4" />
                        <span className="sr-only">Reset Password</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Reset User Password</DialogTitle>
                        <DialogDescription>
                          Enter a new password for {user.email}
                        </DialogDescription>
                      </DialogHeader>
                      <Input
                        type="password"
                        placeholder="New password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                      <DialogFooter>
                        <Button
                          onClick={handleResetPassword}
                          disabled={!newPassword || resetPasswordMutation.isPending}
                        >
                          {resetPasswordMutation.isPending && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          Reset Password
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete User</span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete User</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete {user.email}? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteUserMutation.mutate(user.id)}
                          disabled={deleteUserMutation.isPending}
                        >
                          {deleteUserMutation.isPending && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}