import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function VerifyEmailPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isVerifying, setIsVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const verifyEmail = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const token = searchParams.get("token");

      if (!token) {
        setError("Invalid verification link");
        setIsVerifying(false);
        return;
      }

      try {
        const response = await apiRequest("POST", "/api/verify-email", { token });
        const data = await response.json();

        toast({
          title: "Email verified",
          description: data.message,
        });

        // Redirect to login page after successful verification
        setLocation("/auth");
      } catch (err: any) {
        setError(err.message || "Failed to verify email");
        toast({
          title: "Verification failed",
          description: err.message || "Failed to verify email",
          variant: "destructive",
        });
      } finally {
        setIsVerifying(false);
      }
    };

    verifyEmail();
  }, [setLocation, toast]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Email Verification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isVerifying ? (
            <div className="flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : error ? (
            <>
              <p className="text-red-500">{error}</p>
              <Button onClick={() => setLocation("/auth")} className="w-full">
                Return to Login
              </Button>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
