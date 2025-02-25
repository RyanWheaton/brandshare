import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { SharePage } from "@shared/schema";

// UI Components
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import { TipTapEditor } from "@/components/ui/tiptap-editor";
import { ColorPicker } from "@/components/ui/color-picker";
import { DropboxChooser } from "@/components/ui/dropbox-chooser";
import { Slider } from "@/components/ui/slider";
import { SortableFiles } from "@/components/ui/sortable-files";
import { FontSelect } from "@/components/ui/font-select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// Icons
import {
  Loader2, Save, ChevronLeft, Upload, ExternalLink, Copy, Check, Image, 
  FileText, Film, PanelBottom, Plus, Eye, Clock, Users, MessageCircle,
  Lock, Type, Palette, LayoutTemplate, X, CalendarIcon
} from "lucide-react";

// Utilities & Hooks 
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { convertDropboxUrl } from "@/lib/utils";
import { FilePreview } from "@/pages/share-page";

// Required file type
interface BaseFileObject {
  name: string;
  preview_url: string;
  url: string;
  isFullWidth: boolean;
  title?: string;
  description?: string;
}

interface FileObject extends BaseFileObject {
  storageType: 'dropbox' | 's3';
}

type FormValues = {
  id: number;
  userId: number;
  title: string;
  description: string | null;
  slug: string;
  backgroundColor: string | null;
  backgroundColorSecondary: string | null;
  textColor: string | null;
  files: FileObject[];
  footerText: string | null;
  footerBackgroundColor: string | null;
  footerTextColor: string | null;
  showFooter: boolean;
  footerLogoUrl: string | null;
  footerLogoSize: number | null;
  footerLogoLink: string | null;
  logoUrl: string | null;
  logoSize: number | null;
  buttonBackgroundColor: string | null;
  buttonBorderColor: string | null;
  buttonTextColor: string | null;
  titleFont: string;
  descriptionFont: string;
  titleFontSize: number;
  descriptionFontSize: number;
  expiresAt: string | null;
  lastViewedAt: string | null;
  password: string | null;
  createdAt: string;
  updatedAt: string;
};

interface CustomizePageProps {
  params: { id: string };
  isTemplate?: boolean;
}

interface PreviewProps {
  data: FormValues;
}

const SharePagePreview: React.FC<PreviewProps> = ({ data }) => {
  return (
    <div className="relative">
      <Card className="w-full">
        <CardContent className="p-0">
          <div className="h-[calc(100vh-3.5rem)] overflow-y-auto">
            <div
              className="relative"
              style={{
                backgroundColor: data.backgroundColor || "#ffffff",
                background: data.backgroundColorSecondary
                  ? `linear-gradient(to bottom, ${data.backgroundColor || "#ffffff"}, ${data.backgroundColorSecondary})`
                  : data.backgroundColor || "#ffffff",
              }}
            >
              <div className="p-8 min-h-full">
                {data.logoUrl && (
                  <div className="mb-8 flex justify-center">
                    <img
                      src={convertDropboxUrl(data.logoUrl)}
                      alt="Logo"
                      className="mx-auto object-contain"
                      style={{
                        maxWidth: data.logoSize || 200,
                        maxHeight: data.logoSize || 200
                      }}
                    />
                  </div>
                )}
                <div className="text-center mb-8">
                  <h1
                    className="mb-4 font-bold"
                    style={{
                      fontFamily: data.titleFont || "Inter",
                      fontSize: `${data.titleFontSize || 24}px`,
                      color: data.textColor ?? "#000000"
                    }}
                  >
                    {data.title || "Untitled Share Page"}
                  </h1>
                  {data.description && (
                    <p
                      className="opacity-90"
                      style={{
                        fontFamily: data.descriptionFont || "Inter",
                        fontSize: `${data.descriptionFontSize || 16}px`,
                        color: data.textColor
                      }}
                      dangerouslySetInnerHTML={{ __html: data.description }}
                    />
                  )}
                </div>
                <div className="space-y-4">
                  {data.files?.map((file, index) => (
                    <FilePreview
                      key={index}
                      file={file}
                      textColor={data.textColor}
                      pageId={data.id}
                      fileIndex={index}
                      containerClassName="w-full"
                      sharePage={data as SharePage}
                    />
                  ))}
                </div>
              </div>
              {data.showFooter && (data.footerText || data.footerBackgroundColor || data.footerLogoUrl) && (
                <footer className="w-full mt-8">
                  <div
                    className="w-full py-6 px-4"
                    style={{
                      backgroundColor: data.footerBackgroundColor || "#f3f4f6",
                      color: data.footerTextColor || "#000000",
                    }}
                  >
                    <div className="max-w-4xl mx-auto">
                      {data.footerLogoUrl && (
                        <div className="mb-4 flex justify-center">
                          {data.footerLogoLink ? (
                            <a
                              href={data.footerLogoLink}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <img
                                src={convertDropboxUrl(data.footerLogoUrl)}
                                alt="Footer Logo"
                                className="mx-auto object-contain"
                                style={{
                                  maxWidth: data.footerLogoSize || 150,
                                  maxHeight: data.footerLogoSize || 150
                                }}
                              />
                            </a>
                          ) : (
                            <img
                              src={convertDropboxUrl(data.footerLogoUrl)}
                              alt="Footer Logo"
                              className="mx-auto object-contain"
                              style={{
                                maxWidth: data.footerLogoSize || 150,
                                maxHeight: data.footerLogoSize || 150
                              }}
                            />
                          )}
                        </div>
                      )}
                      {data.footerText && (
                        <div
                          className="prose prose-sm max-w-none"
                          style={{ color: data.footerTextColor || "#000000" }}
                          dangerouslySetInnerHTML={{ __html: data.footerText }}
                        />
                      )}
                    </div>
                  </div>
                </footer>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

interface FilePreviewProps {
  file: BaseFileObject;
  textColor: string | null;
  pageId: number | null;
  fileIndex: number;
  containerClassName?: string;
  sharePage: SharePage;
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
        {isImage && <Image className="w-4 h-4" />}
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

function loadGoogleFont(fontFamily: string) {
  const link = document.createElement('link');
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}&display=swap`;
  link.rel = 'stylesheet';
  document.head.appendChild(link);
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
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (!e.dataTransfer.files?.length) return;

    setIsUploading(true);
    try {
      const uploadedFiles = await Promise.all(
        Array.from(e.dataTransfer.files).map(async (file) => {
          const formData = new FormData();
          formData.append('file', file);

          const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.details || error.error || 'Failed to upload file');
          }

          const data = await response.json();
          return {
            name: file.name,
            url: data.url,
            preview_url: data.url,
            isFullWidth: false,
            storageType: 's3' as const
          };
        })
      );

      onAddFiles(uploadedFiles);
      toast({
        title: "Files uploaded",
        description: `Successfully uploaded ${uploadedFiles.length} file${uploadedFiles.length === 1 ? '' : 's'}.`,
      });
    } catch (error) {
      console.error('Upload failed:', error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "There was an error uploading your files. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  }, [onAddFiles, toast]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.length) return;

    setIsUploading(true);
    try {
      const uploadedFiles = await Promise.all(
        Array.from(event.target.files).map(async (file) => {
          const formData = new FormData();
          formData.append('file', file);

          const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.details || error.error || 'Failed to upload file');
          }

          const data = await response.json();
          return {
            name: file.name,
            url: data.url,
            preview_url: data.url,
            isFullWidth: false,
            storageType: 's3' as const
          };
        })
      );

      onAddFiles(uploadedFiles);
      toast({
        title: "Files uploaded",
        description: `Successfully uploaded ${uploadedFiles.length} file${uploadedFiles.length === 1 ? '' : 's'}.`,
      });
    } catch (error) {
      console.error('Upload failed:', error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "There was an error uploading your files. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      className="space-y-4"
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <div className={`flex flex-col gap-4 ${dragActive ? 'opacity-50' : ''}`}>
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
        <p className="text-[0.65rem] text-muted-foreground text-center uppercase">
          or drag and drop files here
        </p>
      </div>

      {dragActive && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center rounded-lg border-2 border-dashed border-primary">
          <div className="text-center">
            <p className="text-lg font-medium">Drop files here</p>
            <p className="text-sm text-muted-foreground">
              Drop your files to upload them
            </p>
          </div>
        </div>
      )}

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
      />
    </div>
  );
}

export default function CustomizePage({ params, isTemplate = false }: CustomizePageProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isCopied, setIsCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("customize"); 
  const { user } = useAuth();
  const abortControllerRef = useRef<AbortController | null>(null);
  const [activeAccordionItems, setActiveAccordionItems] = useState<string[]>([]);

  // Parse and validate id
  const id = params?.id ? parseInt(params.id) : null;
  if (!id) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Invalid Page ID</h1>
          <p className="text-muted-foreground">
            The page ID provided is invalid.
          </p>
        </div>
      </div>
    );
  }

  // Query the page data
  const { data: item, isLoading } = useQuery<SharePage>({
    queryKey: [`/api/pages/${id}`],
    retry: false,
  });

  const form = useForm<FormValues>({
    defaultValues: item || {
      id: 0,
      userId: user?.id || 0,
      title: "",
      description: null,
      slug: "",
      backgroundColor: null,
      backgroundColorSecondary: null,
      textColor: null,
      files: [],
      footerText: null,
      footerBackgroundColor: null,
      footerTextColor: null,
      showFooter: false,
      footerLogoUrl: null,
      footerLogoSize: null,
      footerLogoLink: null,
      logoUrl: null,
      logoSize: null,
      buttonBackgroundColor: null,
      buttonBorderColor: null,
      buttonTextColor: null,
      titleFont: "Inter",
      descriptionFont: "Inter",
      titleFontSize: 24,
      descriptionFontSize: 16,
      password: null,
      expiresAt: null,
      lastViewedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const response = await apiRequest(
        "PATCH",
        `/api/pages/${id}`,
        data
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update page");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData([`/api/pages/${id}`], data);
      form.reset(data);
      toast({
        title: "Changes saved",
        description: "Your changes have been saved successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  // Handle copying share link to clipboard  
  const handleCopyToClipboard = async () => {
    if (!item) return;
    try {
      const shareUrl = `${window.location.origin}/p/${item.slug}`;
      await navigator.clipboard.writeText(shareUrl);
      setIsCopied(true);
      toast({
        title: "Link copied",
        description: "Share page link has been copied to clipboard.",
      });
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Could not copy the URL to clipboard.",
        variant: "destructive",
      });
    }
  };

  // Handle opening share page in new tab
  const handleOpenSharePage = () => {
    if (!item) return;
    const shareUrl = `${window.location.origin}/p/${item.slug}`;
    window.open(shareUrl, '_blank');
  };

  // Handle saving changes
  const handleSave = () => {
    const formData = form.getValues();
    if (form.formState.isDirty) {
      updateMutation.mutate(formData);
    } else {
      toast({
        title: "No changes to save",
        description: "Make some changes first before saving.",
      });
    }
  };

  // Get icon for accordion section
  const getAccordionIcon = (section: string) => {
    switch (section) {
      case 'files':
        return <FileText className="h-4 w-4" />;
      case 'header':
        return <LayoutTemplate className="h-4 w-4" />;
      case 'typography':
        return <Type className="h-4 w-4" />;
      case 'colors':
        return <Palette className="h-4 w-4" />;
      case 'footer':
        return <PanelBottom className="h-4 w-4" />;
      case 'security':
        return <Lock className="h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Sticky header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={() => setLocation(isTemplate ? "/templates" : "/dashboard")}
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>

          <div className="flex-1" />

          {!isTemplate && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleOpenSharePage}
              >
                <ExternalLink className="h-4 w-4" />
                Open
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleCopyToClipboard}
              >
                {isCopied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                Copy Link
              </Button>
            </div>
          )}

          <Button
            type="button"
            onClick={handleSave}
            disabled={!form.formState.isDirty || updateMutation.isPending}
            className={cn(
              "gap-2",
              form.formState.isDirty
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            )}
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 container flex gap-8">
        {/* Left panel - Editor */}
        <div className="w-[400px] flex-shrink-0">
          <div className="h-[calc(100vh-3.5rem)] overflow-y-auto">
            <div className="py-6">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="w-full">
                  <TabsTrigger className="flex-1" value="customize">
                    Customize
                  </TabsTrigger>
                  {!isTemplate && (
                    <TabsTrigger className="flex-1" value="analytics">
                      Analytics
                    </TabsTrigger>
                  )}
                </TabsList>
                <TabsContent value="customize">
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit((data: FormValues) => updateMutation.mutate(data))} 
                      className="space-y-6">
                      <div className="space-y-4">
                        <Accordion
                          type="multiple"
                          value={activeAccordionItems}
                          onValueChange={setActiveAccordionItems}
                        >
                          {['files', 'header', 'typography', 'colors', 'footer', 'security'].map((section) => (
                            <AccordionItem
                              key={section}
                              value={section}
                              className="border rounded-lg"
                            >
                              <AccordionTrigger className="px-4">
                                <div className="flex items-center gap-2">
                                  {getAccordionIcon(section)}
                                  <span>{section.charAt(0).toUpperCase() + section.slice(1)}</span>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="space-y-4 px-4 pb-4">
                                {/* Content for each section will be added here */}
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      </div>
                    </form>
                  </Form>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>

        {/* Right panel - Preview */}
        <div className="flex-1">
          <div className="sticky top-[3.5rem] h-[calc(100vh-3.5rem)] overflow-y-auto">
            <div className="py-6">
              <SharePagePreview data={form.getValues()} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}