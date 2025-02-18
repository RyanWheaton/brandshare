import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import { DropboxChooser } from "@/components/ui/dropbox-chooser";
import { z } from "zod";
import { changePasswordSchema } from "@shared/schema";
import type { ChangePasswordData } from "@shared/schema";

const profileSchema = z.object({
  username: z.string().min(1, "Username is required"),
  email: z.string().email("Invalid email address"),
  logoUrl: z.string().optional(),
  brandPrimaryColor: z.string().min(1, "Primary color is required"),
  brandSecondaryColor: z.string().min(1, "Secondary color is required"),
});

type ProfileFormData = z.infer<typeof profileSchema>;

function ChangePasswordCard() {
  const { toast } = useToast();
  const form = useForm<ChangePasswordData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: ChangePasswordData) => {
      try {
        const response = await fetch('/api/change-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errorText = await response.text();
          let errorMessage: string;
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.message || 'Failed to change password';
          } catch {
            errorMessage = 'Failed to change password. Please try again.';
          }
          throw new Error(errorMessage);
        }

        const result = await response.json();
        return result;
      } catch (error) {
        if (error instanceof Error) {
          throw error;
        }
        throw new Error('An unexpected error occurred');
      }
    },
    onSuccess: () => {
      toast({
        title: "Password updated",
        description: "Your password has been changed successfully.",
      });
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => changePasswordMutation.mutate(data))} className="space-y-4">
        <FormField
          control={form.control}
          name="currentPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Current Password</FormLabel>
              <FormControl>
                <Input type="password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="newPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New Password</FormLabel>
              <FormControl>
                <Input type="password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={changePasswordMutation.isPending}>
          {changePasswordMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            "Update Password"
          )}
        </Button>
      </form>
    </Form>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      username: user?.username || "",
      email: user?.email || "",
      logoUrl: user?.logoUrl || "",
      brandPrimaryColor: user?.brandPrimaryColor || "#000000",
      brandSecondaryColor: user?.brandSecondaryColor || "#ffffff",
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      const res = await apiRequest("PATCH", "/api/user/profile", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ProfileFormData) => {
    updateProfileMutation.mutate(data);
  };

  return (
    <div className="container max-w-4xl mx-auto p-4">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => setLocation("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold">Profile Settings</h1>
        </div>
        <ThemeSwitcher />
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Your Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  disabled={updateProfileMutation.isPending}
                >
                  {updateProfileMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Changes
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Branding</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="logoUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Logo Image</FormLabel>
                      <FormControl>
                        <div className="space-y-4">
                          <DropboxChooser
                            onFilesSelected={(files) => {
                              if (files.length > 0) {
                                field.onChange(files[0].url);
                              }
                            }}
                          />
                          {field.value && (
                            <div className="mt-4">
                              <img
                                src={field.value}
                                alt="Selected logo"
                                className="max-w-[200px] h-auto rounded-lg border"
                              />
                            </div>
                          )}
                        </div>
                      </FormControl>
                      <FormDescription>
                        Choose your logo image from Dropbox. This logo can be used in your share pages.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="brandPrimaryColor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primary Brand Color</FormLabel>
                        <FormControl>
                          <div className="flex gap-2 items-center">
                            <Input
                              type="color"
                              {...field}
                              className="w-16 h-10 p-1 rounded cursor-pointer"
                            />
                            <Input
                              type="text"
                              value={field.value}
                              onChange={(e) => field.onChange(e.target.value)}
                              className="flex-1"
                              placeholder="#000000"
                            />
                          </div>
                        </FormControl>
                        <FormDescription>
                          Choose your primary brand color
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="brandSecondaryColor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Secondary Brand Color</FormLabel>
                        <FormControl>
                          <div className="flex gap-2 items-center">
                            <Input
                              type="color"
                              {...field}
                              className="w-16 h-10 p-1 rounded cursor-pointer"
                            />
                            <Input
                              type="text"
                              value={field.value}
                              onChange={(e) => field.onChange(e.target.value)}
                              className="flex-1"
                              placeholder="#ffffff"
                            />
                          </div>
                        </FormControl>
                        <FormDescription>
                          Choose your secondary brand color
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={updateProfileMutation.isPending}
                >
                  {updateProfileMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Branding
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
          </CardHeader>
          <CardContent>
            <ChangePasswordCard />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}