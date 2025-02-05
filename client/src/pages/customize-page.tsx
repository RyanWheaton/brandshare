import { useQuery, useMutation } from "@tanstack/react-query";
import { SharePage, insertSharePageSchema, InsertSharePage } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { FilePreview } from "@/pages/share-page";

export default function CustomizePage({ params }: { params: { id: string } }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Safely parse the ID parameter, return to dashboard if invalid
  if (!params?.id || isNaN(parseInt(params.id))) {
    setLocation("/");
    return null;
  }

  const id = parseInt(params.id);

  const { data: page, isLoading } = useQuery<SharePage>({
    queryKey: [`/api/pages/${id}`],
  });

  const form = useForm<InsertSharePage>({
    resolver: zodResolver(insertSharePageSchema),
    defaultValues: {
      title: "",
      description: "",
      backgroundColor: "#ffffff",
      textColor: "#000000",
      files: [],
    },
    values: page ? {
      title: page.title,
      description: page.description || "",
      backgroundColor: page.backgroundColor || "#ffffff",
      textColor: page.textColor || "#000000",
      files: page.files,
    } : undefined,
  });

  const formValues = form.watch();

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<InsertSharePage>) => {
      await apiRequest("PATCH", `/api/pages/${id}`, data);
    },
    onSuccess: () => {
      // Invalidate both the individual page and the pages list
      queryClient.invalidateQueries({ queryKey: [`/api/pages/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/pages"] });
      toast({
        title: "Changes saved",
        description: "Your share page has been updated successfully.",
      });
      setLocation("/");
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (!page) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Page Not Found</h1>
          <p className="text-muted-foreground">
            This share page doesn't exist or has been removed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Edit Form */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Customize Share Page</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit((data) => updateMutation.mutate(data))}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="backgroundColor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Background Color</FormLabel>
                          <FormControl>
                            <div className="flex gap-2">
                              <Input type="color" {...field} className="w-12 h-10 p-1" />
                              <Input {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="textColor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Text Color</FormLabel>
                          <FormControl>
                            <div className="flex gap-2">
                              <Input type="color" {...field} className="w-12 h-10 p-1" />
                              <Input {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save Changes
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        {/* Live Preview */}
        <div className="relative">
          <div className="sticky top-4">
            <Card>
              <CardHeader>
                <CardTitle>Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div 
                  style={{ 
                    backgroundColor: formValues.backgroundColor || "#ffffff",
                    color: formValues.textColor || "#000000",
                    minHeight: "500px",
                    padding: "2rem",
                    borderRadius: "0.5rem",
                  }}
                  className="overflow-auto"
                >
                  <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold mb-4">{formValues.title}</h1>
                    {formValues.description && (
                      <p className="text-lg opacity-90">{formValues.description}</p>
                    )}
                  </div>

                  <div className="grid gap-8">
                    {(page.files as any[]).map((file, index) => (
                      <FilePreview
                        key={index}
                        file={file}
                        textColor={formValues.textColor || "#000000"}
                      />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}