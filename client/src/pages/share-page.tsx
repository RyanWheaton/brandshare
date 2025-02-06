import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { type SharePage, type FileObject, type Annotation } from "@shared/schema";
import { Loader2, FileText, Image as ImageIcon, Film, Plus, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import React from 'react';


type AnnotationProps = {
  annotation: Annotation;
  onDelete?: () => void;
  currentUserId?: number;
};

function AnnotationMarker({ annotation, onDelete, currentUserId }: AnnotationProps) {
  const displayName = annotation.userId ? "User" : (annotation.guestName || "Anonymous");

  return (
    <div 
      className="absolute group"
      style={{ 
        left: `${annotation.positionX}px`, 
        top: `${annotation.positionY}px` 
      }}
    >
      <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center cursor-pointer">
        <Plus className="w-4 h-4" />
      </div>
      <div className="absolute left-full ml-2 bg-background border rounded-lg p-3 shadow-lg min-w-[200px] hidden group-hover:block">
        <div className="text-sm mb-1 text-muted-foreground">{displayName}</div>
        <div className="text-sm">{annotation.content}</div>
        {currentUserId === annotation.userId && onDelete && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="absolute top-1 right-1 h-6 w-6 p-0"
            onClick={onDelete}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

type FilePreviewProps = {
  file: FileObject;
  textColor: string;
  containerClassName?: string;
  pageId?: number;
  fileIndex?: number;
};

export function FilePreview({ file, textColor, containerClassName = "", pageId, fileIndex }: FilePreviewProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [annotationInput, setAnnotationInput] = useState("");
  const [guestName, setGuestName] = useState("");
  const [annotationPosition, setAnnotationPosition] = useState<{ x: number, y: number } | null>(null);

  // Query annotations
  const { data: annotations = [] } = useQuery<Annotation[]>({
    queryKey: [`/api/pages/${pageId}/files/${fileIndex}/annotations`],
    enabled: pageId !== undefined && fileIndex !== undefined,
  });

  // Create annotation mutation
  const createAnnotationMutation = useMutation({
    mutationFn: async (data: { content: string; positionX: number; positionY: number; guestName?: string }) => {
      if (!pageId || fileIndex === undefined) return;
      const response = await apiRequest(
        "POST",
        `/api/pages/${pageId}/files/${fileIndex}/annotations`,
        {
          ...data,
          fileIndex,
        }
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: [`/api/pages/${pageId}/files/${fileIndex}/annotations`] 
      });
      setIsAnnotating(false);
      setAnnotationInput("");
      setGuestName("");
      setAnnotationPosition(null);
      toast({
        title: "Annotation added",
        description: "Your annotation has been added successfully.",
      });
    },
  });

  // Delete annotation mutation
  const deleteAnnotationMutation = useMutation({
    mutationFn: async (annotationId: number) => {
      await apiRequest("DELETE", `/api/annotations/${annotationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: [`/api/pages/${pageId}/files/${fileIndex}/annotations`] 
      });
      toast({
        title: "Annotation deleted",
        description: "Your annotation has been deleted successfully.",
      });
    },
  });

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!user || !pageId || fileIndex === undefined) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setAnnotationPosition({ x, y });
    setIsAnnotating(true);
  };

  const handleAnnotationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!annotationPosition || !annotationInput.trim()) return;

    const data = {
      content: annotationInput,
      positionX: Math.round(annotationPosition.x),
      positionY: Math.round(annotationPosition.y),
      guestName: user ? undefined : guestName || "Anonymous",
    };

    createAnnotationMutation.mutate(data);
  };

  const fileType = file.name.split('.').pop();
  const isImage = fileType ? ['jpg', 'jpeg', 'png', 'gif'].includes(fileType) : false;
  const isVideo = fileType ? ['mp4', 'mov'].includes(fileType) : false;
  const isPDF = fileType === 'pdf';

  const wrapperClass = file.isFullWidth 
    ? "w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw]" 
    : containerClassName;

  return (
    <div className={wrapperClass}>
      <Card className={`overflow-hidden ${file.isFullWidth ? 'rounded-none' : ''}`}>
        <CardContent className="p-0">
          <div className="relative" onClick={user ? handleClick : undefined}>
            {isImage && (
              <div className={`relative bg-muted ${file.isFullWidth ? '' : 'aspect-video'}`}>
                <img
                  src={file.preview_url || file.url}
                  alt={file.name}
                  className={`w-full ${file.isFullWidth ? 'max-h-[80vh] object-cover' : 'h-full object-contain'}`}
                />
              </div>
            )}

            {isVideo && (
              <div className={`relative bg-muted ${file.isFullWidth ? '' : 'aspect-video'}`}>
                <video
                  controls
                  className={`w-full ${file.isFullWidth ? 'max-h-[80vh]' : 'h-full object-contain'}`}
                  src={file.preview_url || file.url}
                >
                  Your browser does not support video playback.
                </video>
              </div>
            )}

            {isPDF && (
              <div className={`relative bg-muted ${file.isFullWidth ? 'h-[80vh]' : 'aspect-[3/4]'}`}>
                <iframe
                  src={file.preview_url || file.url}
                  className="w-full h-full border-0"
                  title={file.name}
                />
              </div>
            )}

            {!isImage && !isVideo && !isPDF && (
              <div className="aspect-video flex items-center justify-center bg-muted">
                <div className="text-center p-4">
                  <FileText className="w-12 h-12 mx-auto mb-2" style={{ color: textColor }} />
                  <p className="text-sm font-medium" style={{ color: textColor }}>
                    {file.name}
                  </p>
                </div>
              </div>
            )}

            {isAnnotating && annotationPosition && (
              <form
                onSubmit={handleAnnotationSubmit}
                className="absolute bg-background border rounded-lg p-2 shadow-lg"
                style={{ 
                  left: annotationPosition.x, 
                  top: annotationPosition.y 
                }}
              >
                {!user && (
                  <Input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Your name (optional)"
                    className="mb-2"
                  />
                )}
                <Input
                  type="text"
                  value={annotationInput}
                  onChange={(e) => setAnnotationInput(e.target.value)}
                  placeholder="Add your annotation..."
                  className="mb-2"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button 
                    type="submit" 
                    size="sm"
                    disabled={createAnnotationMutation.isPending}
                  >
                    {createAnnotationMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Add"
                    )}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setIsAnnotating(false);
                      setAnnotationInput("");
                      setGuestName("");
                      setAnnotationPosition(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}

            {annotations.map((annotation) => (
              <AnnotationMarker
                key={annotation.id}
                annotation={annotation}
                currentUserId={user?.id}
                onDelete={
                  user?.id === annotation.userId
                    ? () => deleteAnnotationMutation.mutate(annotation.id)
                    : undefined
                }
              />
            ))}
          </div>

          <div className="p-4 border-t">
            <div className="flex items-center gap-2">
              {isImage && <ImageIcon className="w-4 h-4" style={{ color: textColor }} />}
              {isVideo && <Film className="w-4 h-4" style={{ color: textColor }} />}
              {!isImage && !isVideo && <FileText className="w-4 h-4" style={{ color: textColor }} />}
              <span className="text-sm font-medium" style={{ color: textColor }}>
                {file.name}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SharePageView({ params }: { params: { slug: string } }) {
  const { user } = useAuth();
  const { data: page, isLoading } = useQuery<SharePage>({
    queryKey: [`/api/p/${params.slug}`],
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
    <div 
      style={{ 
        backgroundColor: page.backgroundColor || "#ffffff",
        color: page.textColor || "#000000",
        minHeight: "100vh",
        padding: "2rem",
      }}
      className="min-h-screen"
    >
      <div className="container max-w-4xl mx-auto">
        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">{page.title}</h1>
          {page.description && (
            <p className="text-lg opacity-90 max-w-2xl mx-auto">{page.description}</p>
          )}
          <p className="text-sm text-muted-foreground mt-4">
            Click anywhere on a file to add annotations
            {!user && " as a guest"}
          </p>
        </header>

        <div className="grid gap-8">
          {(page.files as FileObject[]).map((file, index) => (
            <FilePreview
              key={index}
              file={file}
              textColor={page.textColor || "#000000"}
              pageId={page.id}
              fileIndex={index}
            />
          ))}
        </div>
      </div>
    </div>
  );
}