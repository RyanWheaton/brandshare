import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

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

// Types
import type { SharePage } from "@shared/schema";


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

// Base interface with common properties
// Type definitions
interface ShareFileObject extends BaseFileObject {
  storageType: 'dropbox' | 's3';
}

import type { FC } from 'react';

interface SharePageBase {
  title: string;
  description: string;
  backgroundColor: string;
  backgroundColorSecondary: string | null;
  textColor: string;
  files: ShareFileObject[];
  footerText: string | null;
  footerBackgroundColor: string | null;
  footerTextColor: string | null;
  showFooter: boolean;
  footerLogoUrl: string | null;
  footerLogoSize: number;
  footerLogoLink: string | null;
  logoUrl: string | null;
  logoSize: number;
  buttonBackgroundColor: string;
  buttonBorderColor: string;
  buttonTextColor: string;
  titleFont: string;
  descriptionFont: string;
  titleFontSize: number;
  descriptionFontSize: number;
}

export interface SharePage extends SharePageBase {
  id: number;
  userId: number;
  slug: string;
  password: string | null;
  expiresAt: string | null;
  lastViewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type FormValues = Omit<SharePage, 'createdAt' | 'updatedAt'> & {
  expiresAt?: string | null;
  lastViewedAt?: string | null;
};

type FormValues = {
  id: number;
  userId: number;
  title: string;
  description: string;
  slug: string;
  backgroundColor: string;
  backgroundColorSecondary: string | null;
  textColor: string;
  files: ShareFileObject[];
  footerText: string | null;
  footerBackgroundColor: string | null;
  footerTextColor: string | null;
  showFooter: boolean;
  footerLogoUrl: string | null;
  footerLogoSize: number;
  footerLogoLink: string | null;
  logoUrl: string | null;
  logoSize: number;
  buttonBackgroundColor: string;
  buttonBorderColor: string;
  buttonTextColor: string;
  titleFont: string;
  descriptionFont: string;
  titleFontSize: number;
  descriptionFontSize: number;
  expiresAt?: string | null;
  lastViewedAt?: string | null;
  password: string | null;
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
                      color: data.textColor
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
                    <div key={index}>
                      <FilePreview
                        file={file}
                        textColor={data.textColor}
                        pageId={data.id}
                        fileIndex={index}
                        containerClassName="w-full"
                        sharePage={data as SharePage}
                      />
                    </div>
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
  file: ShareFileObject;
  textColor: string;
  pageId: number;
  fileIndex: number;
  containerClassName?: string;
  sharePage: SharePage;
}

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

export default function CustomizePage({ params, isTemplate = false }: CustomizePageProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isCopied, setIsCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("customize"); 
  const { user } = useAuth();
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isEditorCollapsed, setIsEditorCollapsed] = useState(false);
  const [activeAccordionItems, setActiveAccordionItems] = useState<string[]>([]);

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
                onClick={openSharePage}
              >
                <ExternalLink className="h-4 w-4" />
                Open
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={copyToClipboard}
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
            disabled={!hasUnsavedChanges || updateMutation.isPending}
            className="gap-2"
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Changes
          </Button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 container flex gap-8 py-6">
        {/* Left panel - Editor */}
        <div className="w-[400px] flex-shrink-0">
          <div className="space-y-6">
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
                  <form onSubmit={form.handleSubmit((data) => updateMutation.mutate(data))} 
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
                              {/* Section content */}
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </div>
                  </form>
                </Form>
              </TabsContent>
              {!isTemplate && (
                <TabsContent value="analytics">
                  <Analytics
                    pageId={id}
                    isTemplate={isTemplate}
                    activeTab={activeTab}
                  />
                </TabsContent>
              )}
            </Tabs>
          </div>
        </div>

        {/* Right panel - Preview */}
        <div className="flex-1">
          <SharePagePreview data={form.getValues()} />
        </div>
      </div>
    </div>
  );
              >
                {data.logoUrl && (
                  <img
                    src={convertDropboxUrl(data.logoUrl)}
                    alt="Logo"
                    className="mx-auto object-contain"
                    style={{
                      maxWidth: data.logoSize || 200,
                      maxHeight: data.logoSize || 200
                    }}
                  />
                )}
                <div className="text-center">
                  <h1
                    className="mb-4 font-bold"
                    style={{
                      fontFamily: data.titleFont || "Inter",
                      fontSize: data.titleFontSize || 24,
                      color: data.textColor || "#000000"
                    }}
                  >
                    {data.title}
                  </h1>
                  <p
                    style={{
                      fontFamily: data.descriptionFont || "Inter",
                      fontSize: data.descriptionFontSize || 16,
                      color: data.textColor || "#000000"
                    }}
                  >
                    {data.description}
                  </p>
                </div>
                {data.files && data.files.length > 0 && (
                  <div className="w-full space-y-8">
                    {data.files.map((file, index) => (
                      <FilePreview key={index} {...getPreview(file)} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

type CustomizePageProps = {
  params: { id: string };
  isTemplate?: boolean;
};

const Analytics = ({ pageId, isTemplate, activeTab }: { pageId: number; isTemplate: boolean; activeTab: string }) => {
  const { data: stats, isLoading, error } = useQuery<{
    dailyViews: Record<string, number>;
    hourlyViews: Record<string, number>;
    locationViews: Record<string, { views: number; lastView: string }>;
    totalComments: number;
    fileDownloads: Record<string, number>;
    uniqueVisitors: Record<string, number>;
    totalUniqueVisitors: number;
    averageVisitDuration: number;
    dailyVisitDurations: Record<string, { duration: number; timestamp: string; location?: { city?: string | null; region?: string | null; country?: string | null; key?: string } }[]>;
  }>({
    queryKey: [`/api/pages/${pageId}/analytics`],
    enabled: !isNaN(pageId) && !isTemplate && activeTab === "analytics",
    retry: 3,
    staleTime: 30000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-destructive space-y-2">
        <p>Error loading analytics data. Please try again.</p>
        <p className="text-sm text-muted-foreground">
          {error instanceof Error ? error.message : 'Unknown error occurred'}
        </p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-muted-foreground">
        <p>No analytics data available yet</p>
      </div>
    );
  }

  const today = new Date().toISOString().split('T')[0];
  const dailyViews = stats.dailyViews?.[today] || 0;
  const hourlyViews = stats.hourlyViews || {};
  const currentHour = new Date().getHours();
  const currentHourViews = hourlyViews[currentHour] || 0;
  const locationViews = stats.locationViews || {};

  // Calculate average duration for today's visits
  const todayDurations = stats.dailyVisitDurations[today] || [];
  const validDurations = todayDurations
    .map(visit => visit.duration)
    .filter(duration => typeof duration === 'number' && !isNaN(duration));

  const todayAverageDuration = validDurations.length > 0
    ? Math.round(validDurations.reduce((sum, duration) => sum + duration, 0) / validDurations.length)
    : 0;

  // Format duration in minutes and seconds
  const formatDuration = (seconds: number) => {
    if (typeof seconds !== 'number' || isNaN(seconds)) return 'Invalid duration';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return minutes > 0
      ? `${minutes}m ${remainingSeconds}s`
      : `${remainingSeconds}s`;
  };

  // Helper to format location
  const formatLocation = (location: {
    city?: string | null;
    region?: string | null;
    country?: string | null;
    key?: string;
  } | undefined) => {
    if (!location) return "Location not available";

    // If we have a pre-formatted key, use it
    if (location.key) return location.key;

    // Properly filter out null and undefined values
    const locationParts = [location.city, location.region, location.country]
      .filter((part) => part && part !== "null" && part !== "undefined")
      .join(", ");

    return locationParts.length > 0 ? locationParts : "Unknown Location";
  };

  const topLocations = Object.entries(locationViews)
    .sort(([, a], [, b]) => b.views - a.views)
    .slice(0, 3);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
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
                <p className="text-sm font-medium text-muted-foreground">Unique Visitors Today</p>
                <p className="text-2xl font-bold">{stats?.uniqueVisitors[today] || 0}</p>
              </div>
              <Users className="h-4 w-4 text-muted-foreground" />
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
                <p className="text-2xl font-bold">{stats.totalComments}</p>
              </div>
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Visit Duration Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Average Visit Duration</p>
              <p className="text-xl font-bold">{formatDuration(stats.averageVisitDuration)}</p>
              <p className="text-sm text-muted-foreground mt-1">All time average</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Today's Average Duration</p>
              <p className="text-xl font-bold">{formatDuration(todayAverageDuration)}</p>
              <p className="text-sm text-muted-foreground mt-1">Based on {validDurations.length} visits</p>
            </div>
          </div>
          {todayDurations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Today's Visit Durations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {todayDurations.slice(-5).map((visit, index) => {
                    const timestamp = visit?.timestamp ? new Date(visit.timestamp) : null;
                    const isValidDate = timestamp && !isNaN(timestamp.getTime());
                    const visitNumber = todayDurations.length - (todayDurations.length - 1 - index);

                    return (
                      <div key={index} className="text-sm border rounded-lg p-2">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">Visit {visitNumber}</span>
                          <span className="text-muted-foreground">
                            {typeof visit.duration === 'number' && !isNaN(visit.duration)
                              ? formatDuration(visit.duration)
                              : 'Invalid duration'}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {isValidDate && (
                            <div>{format(timestamp, 'PPpp')}</div>
                          )}
                          <div>Location: {formatLocation(visit.location)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Total Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Page Views</p>
              <p className="text-xl font-bold">
                {Object.values(stats.dailyViews || {}).reduce((a, b) => a + b, 0)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Unique Visitors</p>
              <p className="text-xl font-bold">{stats.totalUniqueVisitors || 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>

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
                    Last viewed: {format(new Date(data.lastView), 'PPpp')}
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
            {Object.entries(stats.fileDownloads || {}).length > 0 ? (
              Object.entries(stats.fileDownloads || {}).map(([name, downloads]) => (
                <div key={name} className="flex justify-between items-center">
                  <span className="text-sm font-medium">{name}</span>
                  <span className="text-sm text-muted-foreground">{downloads} downloads</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No downloads yet</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

type SharePageResponse = {
  id: number;
  userId: number;
  title: string;
  description: string | null;
  backgroundColor: string | null;
  backgroundColorSecondary: string | null;
  textColor: string | null;
  files: FileObject[];
  password: string | null;
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
  slug: string;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastViewedAt: string | null;
};

export default function CustomizePage({ params, isTemplate = false }: CustomizePageProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isCopied, setIsCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("customize"); 
  const { user } = useAuth();
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isEditorCollapsed, setIsEditorCollapsed] = useState(false);
  const [activeAccordionItems, setActiveAccordionItems] = useState<string[]>([]);

  // Parse and validate id at the start

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
    // Create new controller for this component instance
    abortControllerRef.current = new AbortController();

    return () => {
      // Cleanup on unmount
      if (abortControllerRef.current) {
        try {
          console.log("Aborting pending API requests due to navigation...");
          abortControllerRef.current.abort();
          abortControllerRef.current = null; // Reset controller after aborting
        } catch (error) {
          console.error('Error aborting requests:', error);
        }
      }
    };
  }, []);

  // Update analytics on tab change
  useEffect(() => {
    if (activeTab === "analytics" && id) {
      queryClient.invalidateQueries({
        queryKey: [`/api/pages/${id}/analytics`],
        exact: true
      });
    }
  }, [activeTab, id]);

  const { data: item, isLoading } = useQuery<SharePage | SharePageTemplate>({
    queryKey: [apiEndpoint],
    retry: false,
    gcTime: 0,
    staleTime: Infinity,
    enabled: isValidId && activeTab === "customize", // Only fetch when tab is active
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
      buttonBackgroundColor: "#007bff", // Default button color
      buttonBorderColor: "#007bff", // Default button border color
      buttonTextColor: "#ffffff", // Default button text color

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
      buttonBackgroundColor: (item as SharePage).buttonBackgroundColor || "#007bff",
      buttonBorderColor: (item as SharePage).buttonBorderColor || "#007bff",
      buttonTextColor: (item as SharePage).buttonTextColor || "#ffffff",
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
    mutationFn: async (data: FormValues) => {
      try {
        // Ensure we have a valid controller
        if (!abortControllerRef.current || abortControllerRef.current.signal.aborted) {
          abortControllerRef.current = new AbortController();
        }

        const response = await apiRequest("PATCH", apiEndpoint, {
          ...data,
          titleFont: data.titleFont || "Inter",
          descriptionFont: data.descriptionFont || "Inter",
          signal: abortControllerRef.current.signal,
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
        return; // Ignore aborted request responses
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


  // Helper functions for share page actions
  const copyToClipboard = async () => {
    if (!item) return;
    try {
      const shareUrl = `${window.location.origin}/p/${(item as SharePage).slug}`;
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

  // Loading and error states
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
                onClick={openSharePage}
              >
                <ExternalLink className="h-4 w-4" />
                Open
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={copyToClipboard}
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
            onClick={() => {
              const formData = form.getValues();
              updateMutation.mutate(formData);
            }}
            disabled={!hasUnsavedChanges || updateMutation.isPending}
            className="gap-2"
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Changes
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
                  <div className="space-y-8">
                    {/* Form fields here */}
                  </div>
                </TabsContent>
                {!isTemplate && (
                  <TabsContent value="analytics">
                    <Analytics
                      pageId={id}
                      isTemplate={isTemplate}
                      activeTab={activeTab}
                    />
                  </TabsContent>
                )}
              </Tabs>
            </div>
          </div>
        </div>

        {/* Right panel - Preview */}
        <div className="flex-1">
          <div className="sticky top-[3.5rem] h-[calc(100vh-3.5rem)] overflow-y-auto">
            <div className="py-6">
              <SharePagePreview data={formValues} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );


  const getAccordionIcon = (value: string) => {
    switch (value) {
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

  const handleAccordionClick = (section: string, event: React.MouseEvent<HTMLButtonElement>) => {
    if (isEditorCollapsed) {
      event.preventDefault();
      event.stopPropagation();
      setIsEditorCollapsed(false);
      // Wait for the panel to expand before activating the accordion
      setTimeout(() => {
        setActiveAccordionItems([section]);
      }, 300); // Match the transition duration
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
                onClick={openSharePage}
              >
                <ExternalLink className="h-4 w-4" />
                Open
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={copyToClipboard}
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
                    <form onSubmit={form.handleSubmit((data) => updateMutation.mutate(data))} 
                      className="space-y-6">
                      {/* Form fields here */}
                    </form>
                  </Form>
                </TabsContent>
                {!isTemplate && (
                  <TabsContent value="analytics">
                    <Analytics
                      pageId={id}
                      isTemplate={isTemplate}
                      activeTab={activeTab}
                    />
                  </TabsContent>
                )}
              </Tabs>
            </div>
          </div>
        </div>

        {/* Right panel - Preview */}
        <div className="flex-1">
          <div className="sticky top-[3.5rem] h-[calc(100vh-3.5rem)] overflow-y-auto">
            <div className="py-6">
              <SharePagePreview data={formValues} />
            </div>
          </div>
        </div>
      </div>
    </div>
                  >
                    <div className="space-y-4 bg-card rounded-lg border">
                      <Accordion
                        type="multiple"
                        className="space-y-4"
                        value={activeAccordionItems}
                        onValueChange={setActiveAccordionItems}
                      >
                        {['files', 'header', 'typography', 'colors', 'footer', 'security'].map((section) => (
                          <AccordionItem
                            key={section}
                            value={section}
                            className={cn(
                              "border rounded-lg overflow-hidden",
                              isEditorCollapsed && "border-none rounded-none"
                            )}
                          >
                            <AccordionTrigger
                              className={cn(
                                "px-6 hover:no-underline",
                                isEditorCollapsed && "px-0 justify-center [&>svg:last-child]:hidden hover:bg-accent",
                                isEditorCollapsed && activeAccordionItems.includes(section) && "bg-accent"
                              )}
                              onClick={(e) => handleAccordionClick(section, e)}
                            >
                              {isEditorCollapsed ? (
                                <div className="flex items-center justify-center w-full py-3">
                                  {getAccordionIcon(section)}
                                  <span className="sr-only">
                                    {section === 'security' ? 'Security Settings' : section.replace('-', ' ')}
                                  </span>
                                </div>
                              ) : (
                                <>
                                  <span className="flex items-center gap-2">
                                    {getAccordionIcon(section)}
                                    <span className="capitalize">
                                      {section === 'security' ? 'Security Settings' : section.replace('-', ' ')}
                                    </span>
                                  </span>
                                </>
                              )}
                            </AccordionTrigger>
                            <AccordionContent
                              className={cn(
                                isEditorCollapsed && "hidden"
                              )}
                            >
                              {section === 'files' && (
                                <div className="px-6 pb-4">
                                  <div className="space-y-4">
                                    <FileList
                                      files={formValues.files}
                                      onUpdateFile={handleFileUpdate}
                                      onAddFiles={(newFiles) => {
                                        form.setValue('files', [...formValues.files, ...newFiles], { shouldDirty: true });
                                      }}
                                      form={form}
                                    />
                                  </div>
                                </div>
                              )}
                              {section === 'header' && (
                                <div className="px-6 pb-4 space-y-8">
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
                                          <DropboxChooser
                                            onFilesSelected={(files) => {
                                              form.setValue('logoUrl', files[0]?.url || '', { shouldDirty: true });
                                            }}
                                            className="w-full"
                                          >
                                            <Button type="button" variant="outline" className="w-full gap-2">
                                              <Upload className="h-4 w-4" />
                                              Upload Logo
                                            </Button>
                                          </DropboxChooser>
                                        </FormItem>
                                      )}
                                    />

                                    <FormField
                                      control={form.control}
                                      name="logoSize"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel className={cn(
                                            form.formState.dirtyFields[field.name] && "after:content-['*'] after:ml-0.5 after:text-primary"
                                          )}>Logo Size</FormLabel>
                                          <FormDescription>
                                            Adjust the size of your logo
                                          </FormDescription>
                                          <Slider
                                            min={50}
                                            max={400}
                                            step={10}
                                            value={[field.value]}
                                            onValueChange={(values) => field.onChange(values[0])}
                                            className="w-full"
                                          />
                                        </FormItem>
                                      )}
                                    />

                                    {formValues.logoUrl && (
                                      <div className="mt-4">
                                        <h4 className="text-sm font-medium mb-2">Logo Preview</h4>
                                        <LogoPreview url={formValues.logoUrl} size={formValues.logoSize} />
                                      </div>
                                    )}
                                  </div>

                                  <Separator/>

                                  <div className="spacey-4">
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
                                          <FormDescription>
                                            Add a description to display below the title
                                          </FormDescription>
                                          <FormControl>
                                            <TipTapEditor
                                              value={field.value || ''}
                                              onChange={field.onChange}
                                              placeholder="Enter a description..."
                                              className="min-h-[200px] [&_.tiptap]:p-2 [&_.tiptap]:min-h-[200px] [&_.tiptap]:text-foreground [&_.tiptap]:prose-headings:text-foreground [&_.tiptap]:prose-p:text-foreground"
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                  </div>
                                </div>
                              )}
                              {section === 'typography' && (
                                <div className="px-6 pb-4 space-y-8">
                                  <div className="space-y-4">
                                    <h4 className="text-sm font-medium">Title Font Settings</h4>
                                    <FormField
                                      control={form.control}
                                      name="titleFont"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel className={cn(
                                            form.formState.dirtyFields[field.name] && "after:content-['*'] after:ml-0.5 after:text-primary"
                                          )}>Title Font</FormLabel>
                                          <FormDescription>
                                            Choose a font for your page title
                                          </FormDescription>
                                          <FontSelect
                                            value={field.value}
                                            onValueChange={field.onChange}
                                          />
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
                                          <FormDescription>
                                            Adjust the size of your title font (in pixels)
                                          </FormDescription>
                                          <Slider
                                            min={16}
                                            max={72}
                                            step={1}
                                            value={[field.value]}
                                            onValueChange={(values) => field.onChange(values[0])}
                                            className="w-full"
                                          />
                                          <p className="text-sm text-muted-foreground mt-1">
                                            {field.value}px
                                          </p>
                                        </FormItem>
                                      )}
                                    />
                                  </div>

                                  <div className="space-y-4">
                                    <h4 className="text-sm font-medium">Description Font Settings</h4>
                                    <FormField
                                      control={form.control}
                                      name="descriptionFont"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel className={cn(
                                            form.formState.dirtyFields[field.name] && "after:content-['*'] after:ml-0.5 after:text-primary"
                                          )}>Description Font</FormLabel>
                                          <FormDescription>
                                            Choose a font for your page description
                                          </FormDescription>
                                          <FontSelect
                                            value={field.value}
                                            onValueChange={field.onChange}
                                          />
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
                                          <FormDescription>
                                            Adjust the size of your description font (in pixels)
                                          </FormDescription>
                                          <Slider
                                            min={12}
                                            max={48}
                                            step={1}
                                            value={[field.value]}
                                            onValueChange={(values) => field.onChange(values[0])}
                                            className="w-full"
                                          />
                                          <p className="text-sm text-muted-foreground mt-1">
                                            {field.value}px
                                          </p>
                                        </FormItem>
                                      )}
                                    />
                                  </div>
                                </div>
                              )}
                              {section === 'colors' && (
                                <div className="px-6 pb-4 space-y-8">
                                  <div className="space-y-4">
                                    <h4 className="text-sm font-medium">Colors</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                      <FormField
                                        control={form.control}
                                        name="backgroundColor"
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel className={cn(
                                              form.formState.dirtyFields[field.name] && "after:content-['*'] after:ml-0.5 after:text-primary"
                                            )}>Background Color</FormLabel>
                                            <FormControl>
                                              <ColorPicker {...field} />
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
                                            )}>Secondary Background</FormLabel>
                                            <FormControl>
                                              <ColorPicker {...field} />
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
                                              <ColorPicker {...field} />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                      <FormField
                                        control={form.control}
                                        name="buttonBackgroundColor"
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel className={cn(
                                              form.formState.dirtyFields[field.name] && "after:content-['*'] after:ml-0.5 after:text-primary"
                                            )}>Button Background Color</FormLabel>
                                            <FormControl>
                                              <ColorPicker {...field} />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                      <FormField
                                        control={form.control}
                                        name="buttonBorderColor"
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel className={cn(
                                              form.formState.dirtyFields[field.name] && "after:content-['*'] after:ml-0.5 after:text-primary"
                                            )}>Button Border Color</FormLabel>
                                            <FormControl>
                                              <ColorPicker {...field} />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                      <FormField
                                        control={form.control}
                                        name="buttonTextColor"
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel className={cn(
                                              form.formState.dirtyFields[field.name] && "after:content-['*'] after:ml-0.5 after:text-primary"
                                            )}>Button Text Color</FormLabel>
                                            <FormControl>
                                              <ColorPicker {...field} />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                    </div>
                                  </div>

                                </div>
                              )}
                              {section === 'security' && (
                                <div className="px-6 pb-4 space-y-8">
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
                                </div>
                              )}
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                        <AccordionItem value="footer" className="border rounded-lg">
                          <AccordionTrigger className="px-4">
                            <div className="flex items-center gap-2">
                              <PanelBottom className="h-4 w-4" />
                              <span>Footer Settings</span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="space-y-4 px-4 pb-4">
                            <FormField
                              control={form.control}
                              name="showFooter"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                  <div className="space-y-0.5">
                                    <FormLabel>Show Footer</FormLabel>
                                    <FormDescription>
                                      Toggle footer visibility
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

                            {form.watch("showFooter") && (
                              <>
                                <FormField
                                  control={form.control}
                                  name="footerText"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Footer Text</FormLabel>
                                      <FormControl>
                                        <TipTapEditor 
                                          value={field.value || ""}
                                          onChange={field.onChange}
                                          placeholder="Enter footer text"
                                          className="min-h-[100px]"
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
                                      <FormLabel>Footer Logo</FormLabel>
                                      <FormControl>
                                        <DropboxChooser
                                          onFilesSelected={(files) => {
                                            if (files?.[0]) {
                                              form.setValue("footerLogoUrl", files[0].url, {
                                                shouldDirty: true,
                                              });
                                            }
                                          }}
                                        >
                                          <Button
                                            type="button"
                                            variant="outline"
                                            className="w-full gap-2"
                                          >
                                            <Upload className="h-4 w-4" />
                                            Choose Logo
                                          </Button>
                                        </DropboxChooser>
                                      </FormControl>
                                      {field.value && (
                                        <div className="mt-2">
                                          <LogoPreview url={field.value} size={form.watch("footerLogoSize") || 150} />
                                        </div>
                                      )}
                                    </FormItem>
                                  )}
                                />

                                {form.watch("footerLogoUrl") && (
                                  <>
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
                                              onValueChange={(value) => field.onChange(value[0])}
                                            />
                                          </FormControl>
                                          <FormDescription>{field.value || 150}px</FormDescription>
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
                                            <Input
                                              placeholder="Enter URL for logo link"
                                              {...field}
                                            />
                                          </FormControl>
                                          <FormDescription>
                                            Optional: Make the logo clickable with a URL
                                          </FormDescription>
                                        </FormItem>
                                      )}
                                    />
                                  </>
                                )}

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
                                /><FormField
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
                              </>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </div>

                    <div className="sticky bottom-0 flex justify-end gap-2 pt-4 bg-background">
                      {/*This button was removed from here and moved to the header.*/}
                    </div>
                  </form>
                </Form>
              </div>

              {/* Preview section */}
              <div className="relative">
                <SharePagePreview data={formValues} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="analytics">
            <Analytics pageId={id!} isTemplate={isTemplate} activeTab={activeTab} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}