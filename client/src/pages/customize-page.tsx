import { useQuery, useMutation } from "@tanstack/react-query";
import { SharePage, insertSharePageSchema, InsertSharePage } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { FilePreview } from "@/pages/share-page";
import { SortableFiles } from "@/components/ui/sortable-files";
import { useEffect, useCallback } from "react";

// Simple debounce function
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

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
        description: "Your share page has been updated.",
      });
    },
  });

  // Debounced save function
  const debouncedSave = useCallback(
    debounce((data: Partial<InsertSharePage>) => {
      updateMutation.mutate(data);
    }, 500),
    [updateMutation]
  );

  // Watch for form changes and save automatically
  useEffect(() => {
    const subscription = form.watch((value) => {
      debouncedSave(value as Partial<InsertSharePage>);
    });
    return () => subscription.unsubscribe();
  }, [form.watch, debouncedSave]);

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

  const handleFilesReorder = (reorderedFiles: any[]) => {
    form.setValue('files', reorderedFiles);
  };

  return (
    <div className="container mx-auto p-4">
      <div className="grid lg:grid-cols-[30%_70%] gap-8">
        {/* Edit Form */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle>Customize Share Page</CardTitle>
              {updateMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <div className="space-y-4">
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
                </div>
              </Form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Files</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Drag and drop to reorder files
              </p>
              <SortableFiles 
                files={formValues.files} 
                onReorder={handleFilesReorder}
              />
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
                    {(formValues.files as any[]).map((file, index) => (
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