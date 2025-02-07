import React from 'react';
import { useQuery, useMutation } from "@tanstack/react-query";
import { SharePage, SharePageTemplate, insertSharePageSchema, insertTemplateSchema, InsertSharePage, InsertTemplate, FileObject } from "@shared/schema";
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
import { DropboxChooser } from "@/components/ui/dropbox-chooser";
import { SortableFiles } from "@/components/ui/sortable-files";
import { useState } from "react";


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
  onUpdateFile,
  onAddFiles,
  form
}: { 
  files: FileObject[];
  onUpdateFile: (index: number, updates: Partial<FileObject>) => void;
  onAddFiles: (newFiles: FileObject[]) => void;
  form: any;
}) {
  const { toast } = useToast();
  const [shareUrl, setShareUrl] = useState("");

  const handleShareUrlSubmit = () => {
    if (!shareUrl.trim()) return;

    // Validate if it's a Dropbox share URL
    if (!shareUrl.includes('dropbox.com')) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid Dropbox share URL",
        variant: "destructive"
      });
      return;
    }

    try {
      // Extract the file name from the URL
      const fileName = shareUrl.split('/').pop()?.split('?')[0];
      if (!fileName) throw new Error("Could not extract filename");

      // Create the preview URL by replacing dl=0 with raw=1
      const previewUrl = shareUrl.replace('dl=0', 'raw=1');

      // Create the download URL by replacing dl=0 with dl=1
      const downloadUrl = shareUrl.replace('dl=0', 'dl=1');

      // Create a new file object
      const newFile: FileObject = {
        name: decodeURIComponent(fileName),
        preview_url: previewUrl,
        url: downloadUrl,
        isFullWidth: false,
      };

      // Add the new file to the list
      onAddFiles([newFile]);
      setShareUrl(""); // Clear the input
    } catch (error) {
      toast({
        title: "Error processing URL",
        description: "Could not process the Dropbox share URL",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <DropboxChooser onFilesSelected={onAddFiles} />
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Paste Dropbox share URL here..."
          value={shareUrl}
          onChange={(e) => setShareUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleShareUrlSubmit();
            }
          }}
        />
        <Button 
          variant="outline" 
          onClick={handleShareUrlSubmit}
        >
          Add URL
        </Button>
      </div>

      <SortableFiles 
        files={files}
        onReorder={(newFiles) => {
          form.setValue('files', newFiles, { shouldDirty: true });
        }}
        onRemove={(index) => {
          const newFiles = [...files];
          newFiles.splice(index, 1);
          form.setValue('files', newFiles, { shouldDirty: true });
        }}
      />
    </div>
  );
}

type CustomizePageProps = {
  params: { id: string };
  isTemplate?: boolean;
};

export default function CustomizePage({ params, isTemplate = false }: CustomizePageProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  if (!params?.id || isNaN(parseInt(params.id))) {
    setLocation("/");
    return null;
  }

  const id = parseInt(params.id);
  const apiEndpoint = isTemplate ? `/api/templates/${id}` : `/api/pages/${id}`;

  const { data: item, isLoading } = useQuery<SharePage | SharePageTemplate>({
    queryKey: [apiEndpoint],
  });

  const form = useForm<InsertSharePage | InsertTemplate>({
    resolver: zodResolver(isTemplate ? insertTemplateSchema : insertSharePageSchema),
    defaultValues: {
      title: "",
      description: "",
      backgroundColor: "#ffffff",
      textColor: "#000000",
      files: [],
    },
    values: item ? {
      title: item.title,
      description: item.description || "",
      backgroundColor: item.backgroundColor || "#ffffff",
      textColor: item.textColor || "#000000",
      files: item.files as FileObject[],
    } : undefined,
  });

  const formValues = form.watch();

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<InsertSharePage | InsertTemplate>) => {
      await apiRequest("PATCH", apiEndpoint, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiEndpoint] });
      queryClient.invalidateQueries({ queryKey: [isTemplate ? "/api/templates" : "/api/pages"] });
      toast({
        title: "Changes saved",
        description: `Your ${isTemplate ? 'template' : 'share page'} has been updated successfully.`,
      });
      setLocation("/");
    },
  });

  const handleFileUpdate = React.useCallback((index: number, updates: Partial<FileObject>) => {
    const newFiles = [...formValues.files];
    if (updates) {
      newFiles[index] = { ...newFiles[index], ...updates };
      form.setValue('files', newFiles, { shouldDirty: true });
    }
  }, [formValues.files, form]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Not Found</h1>
          <p className="text-muted-foreground">
            This {isTemplate ? 'template' : 'share page'} doesn't exist or has been removed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="grid lg:grid-cols-[30%_70%] gap-8">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Customize {isTemplate ? 'Template' : 'Share Page'}</CardTitle>
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
                Add files from Dropbox and arrange them in your preferred order
              </p>
              <FileList 
                form={form}
                files={formValues.files} 
                onUpdateFile={handleFileUpdate}
                onAddFiles={(newFiles) => {
                  const updatedFiles = [...formValues.files, ...newFiles];
                  form.setValue('files', updatedFiles, { shouldDirty: true });
                }}
              />
            </CardContent>
          </Card>
        </div>

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