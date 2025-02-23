import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SharePage, SharePageTemplate, insertSharePageSchema, insertTemplateSchema } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { convertDropboxUrl } from "@/lib/utils";
import { Plus, Image as ImageIcon, Film, FileText, Loader2, ExternalLink, Copy, Check, ChevronLeft, Upload, AlertCircle, CalendarIcon } from "lucide-react";
import { DropboxChooser } from "@/components/ui/dropbox-chooser";
import { SortableFiles } from "@/components/ui/sortable-files";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Analytics } from "@/components/ui/analytics";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { ColorPicker } from "@/components/ui/color-picker";
import { Separator } from "@/components/ui/separator";
import { FontSelect } from "@/components/ui/font-select";
import { Slider } from "@/components/ui/slider";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TipTapEditor } from "@/components/ui/tiptap-editor";

// Type definitions
interface FileObject {
  name: string;
  preview_url: string;
  url: string;
  isFullWidth: boolean;
  title?: string;
  description?: string;
  storageType: 'dropbox' | 's3';
}

interface FileListProps {
  files: FileObject[];
  onUpdateFile: (index: number, updates: Partial<FileObject>) => void;
  onAddFiles: (newFiles: FileObject[]) => void;
  form: any;
}

interface LogoPreviewProps {
  url: string;
  size: number;
}

interface FormValues {
  title: string;
  description: string;
  files: FileObject[];
  titleFont: string;
  descriptionFont: string;
  titleFontSize: number;
  descriptionFontSize: number;
  backgroundColor: string;
  backgroundColorSecondary?: string;
  textColor: string;
  buttonBackgroundColor: string;
  buttonBorderColor: string;
  buttonTextColor: string;
  logoUrl?: string;
  logoSize?: number;
  showFooter?: boolean;
  footerText?: string;
  footerBackgroundColor?: string;
  footerTextColor?: string;
  footerLogoUrl?: string;
  footerLogoSize?: number;
  footerLogoLink?: string;
  password?: string;
  expiresAt?: string;
}

interface CustomizePageProps {
  params: { id: string };
  isTemplate?: boolean;
}

// Utility functions
async function uploadFileToS3(file: File): Promise<{ url: string; name: string }> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.details || error.error || 'Failed to upload file to S3');
  }

  const data = await response.json();
  return {
    url: data.url,
    name: file.name,
  };
}

// Components
function LogoPreview({ url, size }: LogoPreviewProps) {
  const [dimensions, setDimensions] = useState({ width: size, height: size });

  useEffect(() => {
    if (url) {
      const img = new Image();
      img.onload = () => {
        const aspectRatio = img.width / img.height;
        setDimensions({
          width: size,
          height: Math.round(size / aspectRatio)
        });
      };
      img.src = convertDropboxUrl(url);
    }
  }, [url, size]);

  return (
    <div className="relative w-full h-40 border rounded-lg overflow-hidden">
      <img
        src={convertDropboxUrl(url)}
        alt="Logo Preview"
        className="w-full h-full object-contain"
        style={{
          maxWidth: dimensions.width,
          maxHeight: dimensions.height
        }}
      />
    </div>
  );
}

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

function FileList({ files, onUpdateFile, onAddFiles, form }: FileListProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ url: string; timestamp: number }[]>([]);
  const isUnmountingRef = useRef(false);

  useEffect(() => {
    return () => {
      isUnmountingRef.current = true;
      const unsavedFiles = uploadedFiles.filter(file => {
        const fileAge = Date.now() - file.timestamp;
        return fileAge > 1000;
      });

      if (unsavedFiles.length > 0 && isUnmountingRef.current) {
        console.log('Cleaning up unsaved files:', unsavedFiles);
        unsavedFiles.forEach(async (file) => {
          try {
            if (!file.url) return;

            const fileUrl = new URL(file.url);
            if (!fileUrl.hostname.includes('amazonaws.com')) return;

            const key = decodeURIComponent(fileUrl.pathname.substring(1));
            await fetch(`/api/files/${encodeURIComponent(key)}`, {
              method: 'DELETE',
            });
            console.log('Cleaned up file:', key);
          } catch (error) {
            console.error('Error during file cleanup:', error);
          }
        });
      }
    };
  }, [uploadedFiles]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.length) return;

    setIsUploading(true);
    try {
      const uploadedFiles = await Promise.all(
        Array.from(event.target.files).map(async (file) => {
          const result = await uploadFileToS3(file);
          if (!isUnmountingRef.current) {
            setUploadedFiles(prev => [...prev, { url: result.url, timestamp: Date.now() }]);
          }
          return {
            name: result.name,
            url: result.url,
            preview_url: result.url,
            isFullWidth: false,
            storageType: 's3' as const
          };
        })
      );

      onAddFiles(uploadedFiles);
    } catch (error) {
      console.error('Upload failed:', error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "There was an error uploading your files. Please try again.",
        variant: "destructive",
      });
    } finally {
      if (!isUnmountingRef.current) {
        setIsUploading(false);
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4">
        <div className="flex gap-2">
          <Input
            type="file"
            multiple
            onChange={handleFileSelect}
            className="flex-1"
            disabled={isUploading}
          />
          <DropboxChooser
            onFilesSelected={onAddFiles}
            className="shrink-0"
          >
            <Button type="button" variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Dropbox
            </Button>
          </DropboxChooser>
        </div>
        {isUploading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Uploading files...
          </div>
        )}
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
        onToggleFullWidth={(index) => {
          onUpdateFile(index, { isFullWidth: !files[index].isFullWidth });
        }}
        onUpdateMetadata={(index, updates) => {
          onUpdateFile(index, updates);
        }}
      />
    </div>
  );
}

// Main component
function CustomizePage({ params, isTemplate = false }: CustomizePageProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isCopied, setIsCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("customize");
  const { user } = useAuth();
  const abortControllerRef = useRef<AbortController | null>(null);

  // Parse and validate id at the start
  const id = params?.id ? parseInt(params.id) : null;
  const isValidId = id !== null && !isNaN(id);

  // Redirect if invalid id
  if (!isValidId) {
    setLocation("/");
    return null;
  }

  const apiEndpoint = isTemplate ? `/api/templates/${id}` : `/api/pages/${id}`;

  // Initialize AbortController and handle cleanup
  useEffect(() => {
    abortControllerRef.current = new AbortController();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  const { data: item, isLoading } = useQuery<SharePage | SharePageTemplate>({
    queryKey: [apiEndpoint],
    retry: false,
    gcTime: 0,
    staleTime: Infinity,
    enabled: isValidId && activeTab === "customize",
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(isTemplate ? insertTemplateSchema : insertSharePageSchema),
    defaultValues: {
      title: "",
      description: "",
      backgroundColor: "#ffffff",
      backgroundColorSecondary: "",
      textColor: "#000000",
      titleFont: "Inter",
      descriptionFont: "Inter",
      titleFontSize: 24,
      descriptionFontSize: 16,
      logoSize: 200,
      files: [],
      logoUrl: "",
      footerText: "",
      footerBackgroundColor: "#f3f4f6",
      footerTextColor: "#000000",
      showFooter: true,
      footerLogoUrl: "",
      footerLogoSize: 150,
      footerLogoLink: "",
      buttonBackgroundColor: "#007bff",
      buttonBorderColor: "#007bff",
      buttonTextColor: "#ffffff",
      ...(isTemplate ? {} : {
        password: "",
        expiresAt: undefined,
      }),
    },
    values: item ? {
      title: item.title,
      description: item.description || "",
      backgroundColor: item.backgroundColor || "#ffffff",
      backgroundColorSecondary: (item as SharePage).backgroundColorSecondary || "",
      textColor: item.textColor || "#000000",
      titleFont: item.titleFont || "Inter",
      descriptionFont: item.descriptionFont || "Inter",
      titleFontSize: (item as SharePage).titleFontSize || 24,
      descriptionFontSize: (item as SharePage).descriptionFontSize || 16,
      logoSize: (item as SharePage).logoSize || 200,
      logoUrl: (item as SharePage).logoUrl || "",
      files: item.files as FileObject[],
      footerText: (item as SharePage).footerText || "",
      footerBackgroundColor: (item as SharePage).footerBackgroundColor || "#f3f4f6",
      footerTextColor: (item as SharePage).footerTextColor || "#000000",
      showFooter: (item as SharePage).showFooter ?? true,
      footerLogoUrl: (item as SharePage).footerLogoUrl || "",
      footerLogoSize: (item as SharePage).footerLogoSize || 150,
      footerLogoLink: (item as SharePage).footerLogoLink || "",
      buttonBackgroundColor: (item as SharePage).buttonBackgroundColor || "#007bff",
      buttonBorderColor: (item as SharePage).buttonBorderColor || "#007bff",
      buttonTextColor: (item as SharePage).buttonTextColor || "#ffffff",
      ...(isTemplate ? {} : {
        password: (item as SharePage).password || "",
        expiresAt: (item as SharePage).expiresAt || undefined,
      }),
    } : undefined,
  });

  const handleFileUpdate = (index: number, updates: Partial<FileObject>) => {
    const newFiles = [...form.getValues().files];
    newFiles[index] = { ...newFiles[index], ...updates };
    form.setValue('files', newFiles, { shouldDirty: true });
  };

  const handleAddFiles = (newFiles: FileObject[]) => {
    const currentFiles = form.getValues().files;
    form.setValue('files', [...currentFiles, ...newFiles], { shouldDirty: true });
  };

  const updateMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      try {
        if (!abortControllerRef.current || abortControllerRef.current.signal.aborted) {
          abortControllerRef.current = new AbortController();
        }

        const response = await apiRequest("PATCH", apiEndpoint, {
          signal: abortControllerRef.current.signal,
          ...data,
          titleFont: data.titleFont || "Inter",
          descriptionFont: data.descriptionFont || "Inter",
          ...(isTemplate ? {} : {
            titleFontSize: data.titleFontSize || 24,
            descriptionFontSize: data.descriptionFontSize || 16,
            backgroundColorSecondary: data.backgroundColorSecondary || undefined,
            footerText: data.footerText || "",
            footerBackgroundColor: data.footerBackgroundColor || "#f3f4f6",
            footerTextColor: data.footerTextColor || "#000000",
            showFooter: data.showFooter ?? true,
            footerLogoUrl: data.footerLogoUrl || "",
            footerLogoSize: data.footerLogoSize || 150,
            footerLogoLink: data.footerLogoLink || "",
            buttonBackgroundColor: data.buttonBackgroundColor || "#007bff",
            buttonBorderColor: data.buttonBorderColor || "#007bff",
            buttonTextColor: data.buttonTextColor || "#ffffff",
          })
        });

        return response;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          console.log("Request aborted, skipping error handling.");
          return null;
        }
        throw error;
      }
    },
    onSuccess: (data) => {
      if (data === null) {
        console.log('Request was aborted, skipping success handling');
        return;
      }

      queryClient.invalidateQueries({ queryKey: [apiEndpoint] });
      queryClient.invalidateQueries({ queryKey: [isTemplate ? "/api/templates" : "/api/pages"] });
      toast({
        title: "Changes saved",
        description: `Your ${isTemplate ? 'template' : 'share page'} has been updated successfully.`,
      });
      form.reset(form.getValues());
    },
    onError: (error: Error) => {
      if (error instanceof DOMException && error.name === "AbortError") {
        console.log('Request was aborted cleanly');
        return;
      }

      toast({
        title: "Error",
        description: "Failed to save changes. Please try again.",
        variant: "destructive",
      });
      console.error("Error during update:", error);
    }
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        const formData = form.getValues();
        const hasChanges = form.formState.isDirty ||
          Object.keys(form.formState.dirtyFields).length > 0;

        if (hasChanges) {
          updateMutation.mutate(formData);
        } else {
          toast({
            title: "No changes to save",
            description: "Make some changes first before saving.",
          });
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [form, updateMutation, toast]);

  const copyToClipboard = async () => {
    if (!item) return;

    try {
      const shareUrl = `${window.location.origin}/p/${(item as SharePage).slug}`;
      await navigator.clipboard.writeText(shareUrl);
      setIsCopied(true);
      toast({
        title: "URL copied",
        description: "Share page URL has been copied to your clipboard.",
      });
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Could not copy URL to clipboard.",
        variant: "destructive",
      });
    }
  };

  const openSharePage = () => {
    if (!item) return;
    const shareUrl = `${window.location.origin}/p/${(item as SharePage).slug}`;
    window.open(shareUrl, '_blank');
  };

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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Button
          variant="outline"
          className="gap-2"
          onClick={openSharePage}
        >
          <ExternalLink className="h-4 w-4" />
          Open Page
        </Button>
        <Button
          variant="outline"
          className="gap-2"
          onClick={copyToClipboard}
        >
          {isCopied ? (
            <Check className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          Copy URL
        </Button>
      </div>

      <Tabs defaultValue="customize" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full">
          <TabsTrigger value="customize" className="flex-1">Customize</TabsTrigger>
          {!isTemplate && (
            <TabsTrigger value="analytics" className="flex-1">Analytics</TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="customize">
          <Form {...form}>
            <form className="space-y-8">
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
                        <TipTapEditor
                          content={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <Accordion type="single" collapsible defaultValue="files">
                <AccordionItem value="files">
                  <AccordionTrigger>Files</AccordionTrigger>
                  <AccordionContent>
                    <FileList
                      files={form.getValues().files}
                      onUpdateFile={handleFileUpdate}
                      onAddFiles={handleAddFiles}
                      form={form}
                    />
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="appearance">
                  <AccordionTrigger>Appearance</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="backgroundColor"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Background Color</FormLabel>
                              <FormControl>
                                <ColorPicker {...field} />
                              </FormControl>
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
                                <ColorPicker {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="titleFont"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Title Font</FormLabel>
                              <FormControl>
                                <FontSelect {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="descriptionFont"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Description Font</FormLabel>
                              <FormControl>
                                <FontSelect {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="titleFontSize"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Title Font Size</FormLabel>
                              <FormControl>
                                <Slider
                                  min={12}
                                  max={72}
                                  step={1}
                                  value={[field.value]}
                                  onValueChange={([value]) => field.onChange(value)}
                                />
                              </FormControl>
                              <FormDescription className="text-center">
                                {field.value}px
                              </FormDescription>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="descriptionFontSize"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Description Font Size</FormLabel>
                              <FormControl>
                                <Slider
                                  min={12}
                                  max={48}
                                  step={1}
                                  value={[field.value]}
                                  onValueChange={([value]) => field.onChange(value)}
                                />
                              </FormControl>
                              <FormDescription className="text-center">
                                {field.value}px
                              </FormDescription>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="logo">
                  <AccordionTrigger>Logo</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="logoUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Logo URL</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            {field.value && (
                              <LogoPreview url={field.value} size={form.getValues().logoSize || 200} />
                            )}
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="logoSize"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Logo Size</FormLabel>
                            <FormControl>
                              <Slider
                                min={50}
                                max={500}
                                step={10}
                                value={[field.value || 200]}
                                onValueChange={([value]) => field.onChange(value)}
                              />
                            </FormControl>
                            <FormDescription className="text-center">
                              {field.value || 200}px
                            </FormDescription>
                          </FormItem>
                        )}
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="footer">
                  <AccordionTrigger>Footer</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="showFooter"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between">
                            <FormLabel>Show Footer</FormLabel>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      {form.getValues().showFooter && (
                        <>
                          <FormField
                            control={form.control}
                            name="footerText"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Footer Text</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />

                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="footerBackgroundColor"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Footer Background Color</FormLabel>
                                  <FormControl>
                                    <ColorPicker {...field} />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="footerTextColor"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Footer Text Color</FormLabel>
                                  <FormControl>
                                    <ColorPicker {...field} />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>

                          <FormField
                            control={form.control}
                            name="footerLogoUrl"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Footer Logo URL</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                                {field.value && (
                                  <LogoPreview
                                    url={field.value}
                                    size={form.getValues().footerLogoSize || 150}
                                  />
                                )}
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="footerLogoSize"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Footer Logo Size</FormLabel>
                                <FormControl>
                                  <Slider
                                    min={50}
                                    max={300}
                                    step={10}
                                    value={[field.value || 150]}
                                    onValueChange={([value]) => field.onChange(value)}
                                  />
                                </FormControl>
                                <FormDescription className="text-center">
                                  {field.value || 150}px
                                </FormDescription>
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="footerLogoLink"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Footer Logo Link</FormLabel>
                                <FormControl>
                                  <Input {...field} type="url" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {!isTemplate && (
                  <AccordionItem value="security">
                    <AccordionTrigger>Security</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Password Protection</FormLabel>
                              <FormControl>
                                <Input
                                  type="password"
                                  {...field}
                                  placeholder="Leave empty for no password"
                                />
                              </FormControl>
                              <FormDescription>
                                Optional: Set a password to restrict access
                              </FormDescription>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="expiresAt"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Expiration Date</FormLabel>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      variant="outline"
                                      className={cn(
                                        "w-full pl-3 text-left font-normal",
                                        !field.value && "text-muted-foreground"
                                      )}
                                    >
                                      {field.value ? (
                                        format(new Date(field.value), "PPP")
                                      ) : (
                                        <span>No expiration</span>
                                      )}
                                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={field.value ? new Date(field.value) : undefined}
                                    onSelect={(date) =>
                                      field.onChange(date ? date.toISOString() : undefined)
                                    }
                                    disabled={(date) =>
                                      date < new Date() || date < new Date("1900-01-01")
                                    }
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                              <FormDescription>
                                Optional: Set an expiration date
                              </FormDescription>
                            </FormItem>
                          )}
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>
            </form>
          </Form>
        </TabsContent>
        {!isTemplate && (
          <TabsContent value="analytics">
            <div className="space-y-4">
              {id && (
                <Analytics pageId={id} isTemplate={isTemplate} activeTab={activeTab} />
              )}
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

export default CustomizePage;