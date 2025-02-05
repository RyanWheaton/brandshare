import { useQuery, useMutation } from "@tanstack/react-query";
import { SharePage, insertSharePageSchema, InsertSharePage, FileObject } from "@shared/schema";
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
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { ImageIcon, Film, FileText } from "lucide-react";


function FileItem({ file, onToggleFullWidth, textColor }: { 
  file: FileObject; 
  onToggleFullWidth: (isFullWidth: boolean) => void;
  textColor: string;
}) {
  const fileType = file.name.split('.').pop();
  const isImage = fileType ? /\.(jpg|jpeg|png|gif)$/i.test(file.name) : false;
  const isVideo = fileType ? /\.(mp4|mov)$/i.test(file.name) : false;

  return (
    <div className="flex items-center justify-between gap-4 p-2 bg-background border rounded-lg">
      <div className="flex items-center gap-2">
        {isImage && <ImageIcon className="w-4 h-4" />}
        {isVideo && <Film className="w-4 h-4" />}
        {!isImage && !isVideo && <FileText className="w-4 h-4" />}
        <span className="text-sm font-medium">{file.name}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Full Width</span>
        <Switch
          checked={file.isFullWidth}
          onCheckedChange={onToggleFullWidth}
        />
      </div>
    </div>
  );
}

function FileList({ 
  files, 
  onUpdateFile 
}: { 
  files: FileObject[];
  onUpdateFile: (index: number, updates: Partial<FileObject>) => void;
}) {
  return (
    <div className="space-y-2">
      {files.map((file, index) => (
        <FileItem
          key={index}
          file={file}
          onToggleFullWidth={(isFullWidth) => onUpdateFile(index, { isFullWidth })}
          textColor={"#000000"}
        />
      ))}
    </div>
  );
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
      files: page.files as FileObject[],
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

  const handleFileUpdate = (index: number, updates: Partial<FileObject>) => {
    const newFiles = [...formValues.files];
    newFiles[index] = { ...newFiles[index], ...updates };
    form.setValue('files', newFiles, { shouldDirty: true });
  };

  return (
    <div className="container mx-auto p-4">
      <div className="grid lg:grid-cols-[30%_70%] gap-8">
        {/* Edit Form */}
        <div className="space-y-4">
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
                          <Textarea {...field} value={field.value || ''} />
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
                              <Input 
                                type="color" 
                                {...field} 
                                value={field.value || '#ffffff'}
                                className="w-12 h-10 p-1" 
                              />
                              <Input {...field} value={field.value || '#ffffff'} />
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
                              <Input 
                                type="color" 
                                {...field} 
                                value={field.value || '#000000'}
                                className="w-12 h-10 p-1" 
                              />
                              <Input {...field} value={field.value || '#000000'} />
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

          <Card>
            <CardHeader>
              <CardTitle>Files</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Toggle full-width display for each file
              </p>
              <FileList 
                files={formValues.files} 
                onUpdateFile={handleFileUpdate}
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
                  className="overflow-hidden"
                >
                  <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold mb-4">{formValues.title}</h1>
                    {formValues.description && (
                      <p className="text-lg opacity-90">{formValues.description}</p>
                    )}
                  </div>

                  <div className="grid gap-8">
                    {formValues.files.map((file, index) => (
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