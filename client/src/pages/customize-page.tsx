import React, { useEffect, useState } from 'react';
import { useQuery, useMutation } from "@tanstack/react-query";
import { SharePage, SharePageTemplate, insertSharePageSchema, insertTemplateSchema, InsertSharePage, InsertTemplate, FileObject } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, X, ExternalLink, Copy, Check, ChevronLeft, Upload, Image, Eye, Clock, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { FilePreview as OriginalFilePreview } from "@/pages/share-page";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { ImageIcon, Film, FileText } from "lucide-react";
import { DropboxChooser } from "@/components/ui/dropbox-chooser";
import { SortableFiles } from "@/components/ui/sortable-files";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Lock } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { FontSelect } from "@/components/ui/font-select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";
import { TipTapEditor } from "@/components/ui/tiptap-editor";
import { convertDropboxUrl } from "@/lib/utils";

function loadGoogleFont(fontFamily: string) {
  const link = document.createElement('link');
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}&display=swap`;
  link.rel = 'stylesheet';
  document.head.appendChild(link);
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
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4">
        <DropboxChooser
          onFilesSelected={onAddFiles}
          className="w-full"
        />
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

function LogoPreview({ url, size }: { url: string; size: number }) {
  const [aspectRatio, setAspectRatio] = useState(1);

  useEffect(() => {
    if (url) {
      const imgElement = document.createElement('img');
      imgElement.onload = () => {
        setAspectRatio(imgElement.width / imgElement.height);
      };
      imgElement.src = convertDropboxUrl(url);
    }
  }, [url]);

  const width = size;
  const height = Math.round(size / aspectRatio);

  return (
    <div className="relative w-full h-40 border rounded-lg overflow-hidden">
      <img
        src={convertDropboxUrl(url)}
        alt="Logo Preview"
        className="w-full h-full object-contain"
        style={{
          maxWidth: width,
          maxHeight: height
        }}
      />
    </div>
  );
}

type CustomizePageProps = {
  params: { id: string };
  isTemplate?: boolean;
};

function Analytics({ pageId }: { pageId: number }) {
  const { data: stats, isLoading } = useQuery<{ 
    dailyViews: Record<string, number>;
    hourlyViews: Record<string, number>;
    locationViews: Record<string, { views: number; lastView: string }>;
    totalComments: number;
    fileDownloads: Array<{ name: string; downloads: number }>;
  }>({
    queryKey: [`/api/pages/${pageId}/analytics`],
    enabled: !isNaN(pageId), // Only run query if pageId is valid
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-muted-foreground">
        No analytics data available
      </div>
    );
  }

  const today = new Date().toISOString().split('T')[0];
  const dailyViews = (stats.dailyViews as Record<string, number>)[today] || 0;
  const hourlyViews = stats.hourlyViews as Record<string, number>;
  const locationViews = stats.locationViews as Record<string, { views: number, lastView: string }>;

  // Get current hour's views
  const currentHour = new Date().getHours();
  const currentHourViews = hourlyViews[currentHour] || 0;

  // Get top locations with timestamps
  const topLocations = Object.entries(locationViews || {})
    .sort(([, a], [, b]) => (b.views) - (a.views))
    .slice(0, 3);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Today's Views</p>
                <p className="text-2xl font-bold">{dailyViews}</p>
              </div>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Current Hour</p>
                <p className="text-2xl font-bold">{currentHourViews}</p>
              </div>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Comments</p>
                <p className="text-2xl font-bold">{stats.totalComments || 0}</p>
              </div>
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top Locations</CardTitle>
        </CardHeader>
        <CardContent>
          {topLocations.length > 0 ? (
            <div className="space-y-2">
              {topLocations.map(([location, data]) => (
                <div key={location} className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">{location}</span>
                    <span className="text-sm">{data.views} views</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Last viewed: {new Date(data.lastView).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No location data available yet</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>File Downloads</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.fileDownloads?.map((file: any) => (
              <div key={file.name} className="flex justify-between items-center">
                <span className="text-sm font-medium">{file.name}</span>
                <span className="text-sm text-muted-foreground">{file.downloads} downloads</span>
              </div>
            )) || (
              <p className="text-sm text-muted-foreground">No downloads yet</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function CustomizePage({ params, isTemplate = false }: CustomizePageProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isCopied, setIsCopied] = useState(false);

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
      ...(isTemplate ? {} : {
        password: "",
        expiresAt: undefined,
      }),
    },
    values: item ? {
      title: item.title,
      description: item.description || "",
      backgroundColor: item.backgroundColor || "#ffffff",
      backgroundColorSecondary: isTemplate ? undefined : (item as SharePage).backgroundColorSecondary || "",
      textColor: item.textColor || "#000000",
      titleFont: item.titleFont || "Inter",
      descriptionFont: item.descriptionFont || "Inter",
      titleFontSize: isTemplate ? 24 : (item as SharePage).titleFontSize || 24,
      descriptionFontSize: isTemplate ? 16 : (item as SharePage).descriptionFontSize || 16,
      logoSize: isTemplate ? 200 : (item as SharePage).logoSize || 200,
      logoUrl: (item as SharePage).logoUrl || "",
      files: item.files as FileObject[],
      footerText: (item as SharePage).footerText || "",
      footerBackgroundColor: (item as SharePage).footerBackgroundColor || "#f3f4f6",
      footerTextColor: (item as SharePage).footerTextColor || "#000000",
      showFooter: (item as SharePage).showFooter ?? true,
      footerLogoUrl: (item as SharePage).footerLogoUrl || "",
      footerLogoSize: (item as SharePage).footerLogoSize || 150,
      footerLogoLink: (item as SharePage).footerLogoLink || "",
      ...(isTemplate ? {} : {
        password: (item as SharePage).password || "",
        expiresAt: (item as SharePage).expiresAt || undefined,
      }),
    } : undefined,
  });

  const formValues = form.watch();
  const hasUnsavedChanges = form.formState.isDirty || Object.keys(form.formState.dirtyFields).length > 0;

  useEffect(() => {
    if (formValues.titleFont) {
      loadGoogleFont(formValues.titleFont);
    }
    if (formValues.descriptionFont) {
      loadGoogleFont(formValues.descriptionFont);
    }
  }, [formValues.titleFont, formValues.descriptionFont]);

  const updateMutation = useMutation({
    mutationFn: async (data: InsertSharePage | InsertTemplate) => {
      const response = await apiRequest("PATCH", apiEndpoint, {
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
        })
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiEndpoint] });
      queryClient.invalidateQueries({ queryKey: [isTemplate ? "/api/templates" : "/api/pages"] });
      toast({
        title: "Changes saved",
        description: `Your ${isTemplate ? 'template' : 'share page'} has been updated successfully.`,
      });
      form.reset(form.getValues());
    },
  });

  const handleFileUpdate = React.useCallback((index: number, updates: Partial<FileObject>) => {
    const newFiles = [...formValues.files];
    if (updates) {
      newFiles[index] = { ...newFiles[index], ...updates };
      form.setValue('files', newFiles, { shouldDirty: true });
    }
  }, [formValues.files, form]);

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
    <div className="min-h-screen flex flex-col">
      <div className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex items-center justify-between h-16 gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/")}
              className="shrink-0"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">Back to Dashboard</span>
            </Button>
            <div className="flex flex-col">
              <h1 className="font-semibold text-lg leading-none">
                {item?.title || 'Untitled'}
              </h1>
              <p className="text-sm text-muted-foreground">
                Customize {isTemplate ? 'Template' : 'Share Page'}
              </p>
            </div>
            {hasUnsavedChanges && (
              <Badge variant="outline" className="gap-1">
                <AlertCircle className="h-3 w-3" />
                Unsaved Changes
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={copyToClipboard}
              className="gap-2"
              disabled={!item || isTemplate}
            >
              {isCopied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              Copy URL
            </Button>
            <Button
              variant="outline"
              onClick={openSharePage}
              className="gap-2"
              disabled={!item || isTemplate}
            >
              <ExternalLink className="h-4 w-4" />
              View Page
            </Button>
            <Button
              type="button"
              onClick={() => {
                const formData = form.getValues();
                if (hasUnsavedChanges) {
                  updateMutation.mutate(formData);
                } else {
                  toast({
                    title: "No changes to save",
                    description: "Make some changes first before saving.",
                  });
                }
              }}
              disabled={updateMutation.isPending}
              className={cn(
                "gap-2",
                hasUnsavedChanges
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              )}
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Changes
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 container mx-auto p-4">
        <Tabs defaultValue="customize" className="space-y-6">
          <TabsList>
            <TabsTrigger value="customize">Customize</TabsTrigger>
            <TabsTrigger value="analytics" disabled={isTemplate}>Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="customize" className="space-y-6">
            <div className="grid lg:grid-cols-[30%_70%] gap-8">
              <Form {...form}>
                <form onSubmit={form.handleSubmit((data) => updateMutation.mutate(data))} className="space-y-6">
                  <div className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Header</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-8">
                        <div className="space-y-4">
                          <h4 className="text-sm font-medium">Logo Settings</h4>
                          <FormField
                            control={form.control}
                            name="logoUrl"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className={cn(
                                  form.formState.dirtyFields[field.name] && "after:content-['*'] after:ml-0.5 after:text-primary"
                                )}>Upload Logo</FormLabel>
                                <FormDescription>
                                  Upload your logo to display above the title
                                </FormDescription>
                                <FormControl>
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                      <Input {...field} placeholder="Enter logo URL or use Dropbox" />
                                      <DropboxChooser
                                        onFilesSelected={(files) => {
                                          if (files.length > 0) {
                                            form.setValue('logoUrl', files[0].url, { shouldDirty: true });
                                          }
                                        }}
                                        className="shrink-0"
                                      >
                                        <Button type="button" variant="outline" size="icon">
                                          <Upload className="h-4 w-4" />
                                        </Button>
                                      </DropboxChooser>
                                      {field.value && (
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="icon"
                                          onClick={() => form.setValue('logoUrl', '', { shouldDirty: true })}
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </div>
                                    {field.value && (
                                      <LogoPreview url={field.value} size={formValues.logoSize || 200} />
                                    )}
                                  </div>
                                </FormControl>
                                <FormMessage />
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
                                  <div className="flex items-center gap-4">
                                    <Slider
                                      min={50}
                                      max={800}
                                      step={10}
                                      value={[field.value ?? 200]}
                                      onValueChange={(value) => field.onChange(value[0])}
                                      className="flex-1"
                                    />
                                    <span className="w-12 text-right">{field.value ?? 200}px</span>
                                  </div>
                                </FormControl>
                                <FormDescription>
                                  Adjust logo size (maintains aspect ratio)
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <Separator />

                        <div className="space-y-4">
                          <h4 className="text-sm font-medium">Content</h4>
                          <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className={cn(
                                  form.formState.dirtyFields[field.name] && "after:content-['*'] after:ml-0.5 after:text-primary"
                                )}>Title</FormLabel>
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
                                <FormLabel className={cn(
                                  form.formState.dirtyFields[field.name] && "after:content-['*'] after:ml-0.5 after:text-primary"
                                )}>Description</FormLabel>
                                <FormControl>
                                  <Textarea {...field} value={field.value || ''} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Body</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-8">
                        <div className="space-y-4">
                          <h4 className="text-sm font-medium">Appearance</h4>
                          <div className="grid gap-4">
                            <FormField
                              control={form.control}
                              name="backgroundColor"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className={cn(
                                    form.formState.dirtyFields[field.name] && "after:content-['*'] after:ml-0.5 after:text-primary"
                                  )}>Background Color</FormLabel>
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
                              name="backgroundColorSecondary"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className={cn(
                                    form.formState.dirtyFields[field.name] && "after:content-['*'] after:ml-0.5 after:text-primary"
                                  )}>Secondary Background Color (Optional)</FormLabel>
                                  <FormDescription>
                                    Add a second color to create a vertical gradient background
                                  </FormDescription>
                                  <FormControl>
                                    <div className="flex gap-2">
                                      <Input
                                        type="color"
                                        {...field}
                                        value={field.value || '#ffffff'}
                                        className="w-12 h-10 p-1"
                                      />
                                      <Input {...field} value={field.value || ''} />
                                      {field.value && (
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="icon"
                                          className="shrink-0"
                                          onClick={() => form.setValue('backgroundColorSecondary', '', { shouldDirty: true })}
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      )}
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
                                  <FormLabel className={cn(
                                    form.formState.dirtyFields[field.name] && "after:content-['*'] after:ml-0.5 after:text-primary"
                                  )}>Text Color</FormLabel>
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
                        </div>

                        <Separator />

                        <div className="space-y-4">
                          <h4 className="text-sm font-medium">Typography</h4>
                          <div className="grid gap-4">
                            <FormField
                              control={form.control}
                              name="titleFont"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className={cn(
                                    form.formState.dirtyFields[field.name] && "after:content-['*'] after:ml-0.5 after:text-primary"
                                  )}>Title Font</FormLabel>
                                  <FormControl>
                                    <FontSelect
                                      value={field.value || "Inter"}
                                      onValueChange={field.onChange}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="titleFontSize"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className={cn(
                                    form.formState.dirtyFields[field.name] && "after:content-['*'] after:ml-0.5 after:text-primary"
                                  )}>Title Font Size</FormLabel>
                                  <FormControl>
                                    <div className="flex items-center gap-4">
                                      <Slider
                                        min={12}
                                        max={48}
                                        step={1}
                                        value={[field.value]}
                                        onValueChange={(value) => field.onChange(value[0])}
                                        className="flex-1"
                                      />
                                      <span className="w-12 text-right">{field.value}px</span>
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="descriptionFont"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className={cn(
                                    form.formState.dirtyFields[field.name] && "after:content-['*'] after:ml-0.5 after:text-primary"
                                  )}>Body Font</FormLabel>
                                  <FormControl>
                                    <FontSelect
                                      value={field.value || "Inter"}
                                      onValueChange={field.onChange}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="descriptionFontSize"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className={cn(
                                    form.formState.dirtyFields[field.name] && "after:content-['*'] after:ml-0.5 after:text-primary"
                                  )}>Description Font Size</FormLabel>
                                  <FormControl>
                                    <div className="flex items-center gap-4">
                                      <Slider
                                        min={12}
                                        max={32}
                                        step={1}
                                        value={[field.value]}
                                        onValueChange={(value) => field.onChange(value[0])}
                                        className="flex-1"
                                      />
                                      <span className="w-12 text-right">{field.value}px</span>
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Files</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <FileList
                          files={formValues.files}
                          onUpdateFile={handleFileUpdate}
                          onAddFiles={(files) => {
                            form.setValue('files', [...formValues.files, ...files], { shouldDirty: true });
                          }}
                          form={form}
                        />
                      </CardContent>
                    </Card>

                    {!isTemplate && (
                      <Card>
                        <CardHeader>
                          <CardTitle>Security Settings</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-8">
                          <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className={cn(
                                  form.formState.dirtyFields[field.name] && "after:content-['*'] after:ml-0.5 after:text-primary"
                                )}>Password Protection</FormLabel>
                                <FormDescription>
                                  Set a password to restrict access to this share page
                                </FormDescription>
                                <FormControl>
                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="password"
                                      {...field}
                                      value={field.value || ''}
                                      placeholder="Enter a password"
                                    />
                                    {field.value && (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={() => form.setValue('password', '', { shouldDirty: true })}
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="expiresAt"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className={cn(
                                  form.formState.dirtyFields[field.name] && "after:content-['*'] after:ml-0.5 after:text-primary"
                                )}>Expiration Date</FormLabel>
                                <FormDescription>
                                  Set a date when this share page will no longer be accessible
                                </FormDescription>
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
                                          <span>Pick a date</span>
                                        )}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                      </Button>
                                    </FormControl>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                      mode="single"
                                      selected={field.value ? new Date(field.value) : undefined}
                                      onSelect={(date) => field.onChange(date?.toISOString())}
                                      disabled={(date) => date < new Date()}
                                      initialFocus
                                    />
                                  </PopoverContent>
                                </Popover>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </CardContent>
                      </Card>
                    )}

                    <Card>
                      <CardHeader>
                        <CardTitle>Footer Settings</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-8">
                        <FormField
                          control={form.control}
                          name="showFooter"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel className={cn(
                                  form.formState.dirtyFields[field.name] && "after:content-['*'] after:ml-0.5 after:text-primary"
                                )}>Show Footer</FormLabel>
                                <FormDescription>
                                  Toggle footer visibility on the share page
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="footerLogoUrl"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className={cn(
                                form.formState.dirtyFields[field.name] && "after:content-['*'] after:ml-0.5 after:text-primary"
                              )}>Footer Logo</FormLabel>
                              <FormDescription>
                                Upload a logo to display above the footer text
                              </FormDescription>
                              <FormControl>
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <Input {...field} placeholder="Enter logo URL or use Dropbox" />
                                    <DropboxChooser
                                      onFilesSelected={(files) => {
                                        if (files.length > 0) {
                                          form.setValue('footerLogoUrl', files[0].url, { shouldDirty: true });
                                        }
                                      }}
                                      className="shrink-0"
                                    >
                                      <Button type="button" variant="outline" size="icon">
                                        <Upload className="h-4 w-4" />
                                      </Button>
                                    </DropboxChooser>
                                    {field.value && (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={() => form.setValue('footerLogoUrl', '', { shouldDirty: true })}
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                  {field.value && (
                                    <LogoPreview url={field.value} size={formValues.footerLogoSize || 150} />
                                  )}
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="footerLogoLink"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className={cn(
                                form.formState.dirtyFields[field.name] && "after:content-['*'] after:ml-0.5 after:text-primary"
                              )}>Footer Logo Link</FormLabel>
                              <FormDescription>
                                Add a URL to make the footer logo clickable (optional)
                              </FormDescription>
                              <FormControl>
                                <Input {...field} placeholder="Enter URL (e.g., https://example.com)" />
                              </FormControl>
                              <FormMessage />
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
                                <div className="flex items-center gap-4">
                                  <Slider
                                    min={50}
                                    max={800}
                                    step={10}
                                    value={[field.value ?? 150]}
                                    onValueChange={(value) => field.onChange(value[0])}
                                    className="flex-1"
                                  />
                                  <span className="w-12 text-right">{field.value ?? 150}px</span>
                                </div>
                              </FormControl>
                              <FormDescription>
                                Adjust footer logo size (maintains aspect ratio)
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="footerText"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className={cn(
                                form.formState.dirtyFields[field.name] && "after:content-['*'] after:ml-0.5 after:text-primary"
                              )}>Footer Text</FormLabel>
                              <FormDescription>
                                Add formatted text to be displayed in the footer
                              </FormDescription>
                              <FormControl>
                                <TipTapEditor
                                  value={field.value || ''}
                                  onChange={field.onChange}
                                  className="min-h-[150px]"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="footerBackgroundColor"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className={cn(
                                  form.formState.dirtyFields[field.name] && "after:content-['*'] after:ml-0.5 after:text-primary"
                                )}>Footer Background Color</FormLabel>
                                <FormControl>
                                  <div className="flex gap-2">
                                    <Input
                                      type="color"
                                      {...field}
                                      value={field.value || '#f3f4f6'}
                                      className="w-12 h-10 p-1"
                                    />
                                    <Input {...field} value={field.value || '#f3f4f6'} />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="footerTextColor"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className={cn(
                                  form.formState.dirtyFields[field.name] && "after:content-['*'] after:ml-0.5 after:text-primary"
                                )}>Footer Text Color</FormLabel>
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
                      </CardContent>
                    </Card>

                    <Separator className="my-4" />

                  </div>
                </form>
              </Form>

              <div className="relative h-[calc(100vh-5rem)]">
                <div className="h-full">
                  <Card className="w-full h-full overflow-hidden">
                    <CardContent className="p-0 relative h-full">
                      <div
                        className="absolute inset-0 overflow-y-auto"
                        style={{
                          backgroundColor: formValues.backgroundColor || "#ffffff",
                          background: formValues.backgroundColorSecondary
                            ? `linear-gradient(to bottom, ${formValues.backgroundColor || "#ffffff"}, ${formValues.backgroundColorSecondary})`
                            : formValues.backgroundColor || "#ffffff",
                        }}
                      >
                        <div className="p-8 min-h-full">
                          {formValues.logoUrl && (
                            <div className="mb-8 flex justify-center">
                              <img
                                src={convertDropboxUrl(formValues.logoUrl)}
                                alt="Logo"
                                className="mx-auto object-contain"
                                style={{
                                  maxWidth: formValues.logoSize || 200,
                                  maxHeight: formValues.logoSize || 200
                                }}
                              />
                            </div>
                          )}
                          <div className="text-center mb-8">
                            <h1
                              className="mb-4 font-bold"
                              style={{
                                fontFamily: formValues.titleFont || "Inter",
                                fontSize: `${formValues.titleFontSize || 24}px`,
                                color: formValues.textColor
                              }}
                            >
                              {formValues.title || "Untitled Share Page"}
                            </h1>
                            {formValues.description && (
                              <p
                                className="opacity-90"
                                style={{
                                  fontFamily: formValues.descriptionFont || "Inter",
                                  fontSize: `${formValues.descriptionFontSize || 16}px`,
                                  color: formValues.textColor
                                }}
                              >
                                {formValues.description}
                              </p>
                            )}
                          </div>
                          <div className="space-y-4">
                            {(formValues.files as FileObject[])?.map((file, index) => (
                              <OriginalFilePreview
                                key={index}
                                file={file}
                                textColor={formValues.textColor}
                                containerClassName={cn(
                                  "w-full",
                                  file.isFullWidth ? "" : "max-w-4xl mx-auto"
                                )}
                              />
                            ))}
                          </div>
                        </div>
                        {formValues.showFooter && (formValues.footerText || formValues.footerBackgroundColor || formValues.footerLogoUrl) && (
                          <footer className="w-full mt-8">
                            <div
                              className="w-full py-6 px-4"
                              style={{
                                backgroundColor: formValues.footerBackgroundColor || "#f3f4f6",
                                color: formValues.footerTextColor || "#000000",
                              }}
                            >
                              <div className="max-w-4xl mx-auto">
                                {formValues.footerLogoUrl && (
                                  <div className="mb-4 flex justify-center">
                                    {formValues.footerLogoLink ? (
                                      <a
                                        href={formValues.footerLogoLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        <img
                                          src={convertDropboxUrl(formValues.footerLogoUrl)}
                                          alt="Footer Logo"
                                          className="mx-auto object-contain"
                                          style={{
                                            maxWidth: formValues.footerLogoSize || 150,
                                            maxHeight: formValues.footerLogoSize || 150
                                          }}
                                        />
                                      </a>
                                    ) : (
                                      <img
                                        src={convertDropboxUrl(formValues.footerLogoUrl)}
                                        alt="Footer Logo"
                                        className="mx-auto object-contain"
                                        style={{
                                          maxWidth: formValues.footerLogoSize || 150,
                                          maxHeight: formValues.footerLogoSize || 150
                                        }}
                                      />
                                    )}
                                  </div>
                                )}
                                {formValues.footerText && (
                                  <div
                                    className="prose prose-sm max-w-none"
                                    style={{ color: formValues.footerTextColor || "#000000" }}
                                    dangerouslySetInnerHTML={{ __html: formValues.footerText }}
                                  />
                                )}
                              </div>
                            </div>
                          </footer>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            {!isTemplate && id && <Analytics pageId={id} />}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}