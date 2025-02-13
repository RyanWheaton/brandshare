import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { type SharePage, type FileObject, type Annotation } from "@shared/schema";
import {
  Loader2,
  FileText,
  Image as ImageIcon,
  Film,
  MessageCircle,
  Lock,
  LayoutGrid,
  Maximize,
  Image,
  ChevronLeft,
  ChevronRight,
  X
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { PDFViewer } from "@/components/ui/pdf-viewer";
import React from 'react';

type CommentProps = {
  annotation: Annotation;
  onDelete?: () => void;
  currentUserId?: number;
};

function Comment({ annotation, onDelete, currentUserId }: CommentProps) {
  const displayName = annotation.userId ? "User" : (annotation.guestName || "Anonymous");
  const formattedDate = format(new Date(annotation.createdAt), 'MMM d, yyyy h:mm a');

  return (
    <div className="flex gap-3 py-3 border-t bg-white">
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-gray-900">{displayName}</div>
          <div className="text-xs text-gray-500">{formattedDate}</div>
        </div>
        <p className="mt-1 text-sm text-gray-700">{annotation.content}</p>
      </div>
      {currentUserId === annotation.userId && onDelete && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={onDelete}
        >
          <FileText className="h-4 w-4" />
          <span className="sr-only">Delete comment</span>
        </Button>
      )}
    </div>
  );
}

type FilePreviewProps = {
  file: FileObject;
  textColor: string;
  containerClassName?: string;
  pageId?: number;
  fileIndex?: number;
  viewMode: 'grid' | 'large' | 'gallery';
  onGalleryOpen?: () => void;
};

function CommentsSkeleton() {
  return (
    <div className="space-y-4 px-4 pb-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-3 py-3 border-t">
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div className="w-24 h-4 bg-gray-200 rounded animate-pulse" />
              <div className="w-32 h-3 bg-gray-200 rounded animate-pulse" />
            </div>
            <div className="mt-2 space-y-2">
              <div className="w-full h-4 bg-gray-200 rounded animate-pulse" />
              <div className="w-2/3 h-4 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

type ViewMode = 'grid' | 'large' | 'gallery';

function loadGoogleFont(fontFamily: string) {
  const link = document.createElement('link');
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}&display=swap`;
  link.rel = 'stylesheet';
  document.head.appendChild(link);
}

export function FilePreview({
  file,
  textColor,
  containerClassName = "",
  pageId,
  fileIndex,
  viewMode,
  onGalleryOpen,
}: FilePreviewProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [commentInput, setCommentInput] = useState("");
  const [guestName, setGuestName] = useState("");
  const [isCommenting, setIsCommenting] = useState(false);

  const { data: comments = [], isLoading: isLoadingComments } = useQuery<Annotation[]>({
    queryKey: [`/api/pages/${pageId}/files/${fileIndex}/annotations`],
    enabled: pageId !== undefined && fileIndex !== undefined,
  });

  const createCommentMutation = useMutation({
    mutationFn: async (data: { content: string; guestName?: string }) => {
      if (!pageId || fileIndex === undefined) return;
      const response = await apiRequest(
        "POST",
        `/api/pages/${pageId}/files/${fileIndex}/annotations`,
        {
          ...data,
          fileIndex,
          positionX: 0,
          positionY: 0,
        }
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/pages/${pageId}/files/${fileIndex}/annotations`]
      });
      setCommentInput("");
      setGuestName("");
      setIsCommenting(false);
      toast({
        title: "Comment added",
        description: "Your comment has been added successfully.",
      });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (annotationId: number) => {
      await apiRequest("DELETE", `/api/annotations/${annotationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/pages/${pageId}/files/${fileIndex}/annotations`]
      });
      toast({
        title: "Comment deleted",
        description: "Your comment has been deleted successfully.",
      });
    },
  });

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim()) return;

    createCommentMutation.mutate({
      content: commentInput,
      guestName: user ? undefined : guestName || "Anonymous",
    });
  };

  const fileType = file.name.split('.').pop()?.toLowerCase();
  const isImage = fileType ? ['jpg', 'jpeg', 'png', 'gif'].includes(fileType) : false;
  const isVideo = fileType ? ['mp4', 'mov'].includes(fileType) : false;
  const isPDF = fileType === 'pdf';

  const convertDropboxUrl = (url: string): string => {
    if (!url.includes('dropbox.com')) return url;

    // Replace dl=0 with dl=1 and raw=1 with dl=1
    let convertedUrl = url
      .replace('?dl=0', '?dl=1')
      .replace('?raw=1', '?dl=1')
      .replace('www.dropbox.com', 'dl.dropboxusercontent.com');

    // If no dl parameter exists, add it
    if (!convertedUrl.includes('dl=1')) {
      convertedUrl += convertedUrl.includes('?') ? '&dl=1' : '?dl=1';
    }

    return convertedUrl;
  };

  const renderContent = () => {
    if (isImage) {
      return (
        <div className="relative" onClick={viewMode !== 'gallery' && onGalleryOpen ? onGalleryOpen : undefined}>
          <img
            src={convertDropboxUrl(file.preview_url || file.url)}
            alt={file.name}
            className={`w-full h-auto ${
              viewMode === 'grid'
                ? 'aspect-square object-cover cursor-pointer'
                : viewMode === 'gallery'
                ? 'max-h-[90vh] object-contain'
                : !file.isFullWidth
                ? 'max-w-4xl mx-auto'
                : ''
            }`}
            loading="lazy"
          />
        </div>
      );
    }

    if (isVideo) {
      const videoUrl = convertDropboxUrl(file.preview_url || file.url);
      return (
        <div
          className={`relative ${
            viewMode === 'grid'
              ? 'aspect-square bg-gray-100 cursor-pointer'
              : viewMode === 'gallery'
              ? 'max-h-[90vh]'
              : `aspect-video bg-gray-100 ${!file.isFullWidth ? 'max-w-4xl mx-auto' : ''}`
          }`}
          onClick={viewMode !== 'gallery' && onGalleryOpen ? onGalleryOpen : undefined}
        >
          <video
            controls={viewMode !== 'grid'}
            preload="metadata"
            className={`w-full h-full ${viewMode === 'grid' ? 'object-cover' : 'object-contain'}`}
            src={videoUrl}
          >
            <source src={videoUrl} type={`video/${fileType}`} />
            Your browser does not support video playback.
          </video>
        </div>
      );
    }

    if (isPDF) {
      return (
        <div
          className={`relative bg-gray-100 w-full ${
            viewMode === 'grid'
              ? 'aspect-square cursor-pointer'
              : viewMode === 'gallery'
              ? 'max-h-[90vh]'
              : !file.isFullWidth
              ? 'max-w-4xl mx-auto'
              : ''
          }`}
          onClick={viewMode !== 'gallery' && onGalleryOpen ? onGalleryOpen : undefined}
        >
          {viewMode === 'grid' ? (
            <div className="flex items-center justify-center h-full">
              <FileText className="w-12 h-12" style={{ color: textColor }} />
            </div>
          ) : (
            <PDFViewer
              url={convertDropboxUrl(file.preview_url || file.url)}
              className="w-full min-h-[90vh] max-w-none"
            />
          )}
        </div>
      );
    }

    // Fallback for unsupported file types
    return (
      <div
        className={`${
          viewMode === 'grid'
            ? 'aspect-square'
            : 'aspect-video'
        } flex items-center justify-center bg-gray-100 ${
          viewMode !== 'grid' && !file.isFullWidth ? 'max-w-4xl mx-auto' : ''
        }`}
        onClick={viewMode !== 'gallery' && onGalleryOpen ? onGalleryOpen : undefined}
      >
        <div className="text-center p-4">
          <FileText className="w-12 h-12 mx-auto mb-2" style={{ color: textColor }} />
          <p className="text-sm font-medium" style={{ color: textColor }}>
            {file.name}
          </p>
        </div>
      </div>
    );
  };

  // Don't show comments in grid or gallery mode
  if (viewMode === 'grid' || viewMode === 'gallery') {
    return (
      <div className={containerClassName} style={{ backgroundColor: 'transparent' }}>
        <Card className="overflow-hidden border-0 shadow-none !bg-transparent">
          <CardContent className="p-0">{renderContent()}</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={containerClassName}>
      <Card className={`overflow-hidden border-0 shadow-none !bg-white ${
        file.isFullWidth ? '!bg-transparent' : ''
      } ${file.isFullWidth ? 'max-w-4xl mx-auto' : ''}`}>
        <CardContent className="p-0">
          {renderContent()}
          <div className={`border-t !bg-white ${
            file.isFullWidth ? 'max-w-4xl mx-auto' : ''
          } p-4`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isImage && <ImageIcon className="w-4 h-4" style={{ color: textColor }} />}
                {isVideo && <Film className="w-4 h-4" style={{ color: textColor }} />}
                {!isImage && !isVideo && <FileText className="w-4 h-4" style={{ color: textColor }} />}
                <span className="text-sm font-medium" style={{ color: textColor }}>
                  {file.name}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 hover:bg-gray-100 !text-gray-900"
                onClick={() => setIsCommenting(!isCommenting)}
              >
                <MessageCircle className="w-4 h-4" />
                <span>{comments.length}</span>
              </Button>
            </div>
          </div>

          {isCommenting && (
            <div className="px-4 pb-4 !bg-white">
              <form onSubmit={handleCommentSubmit} className="space-y-3 mb-4">
                {!user && (
                  <Input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Your name (optional)"
                    className="!bg-white !text-gray-900 !border-gray-300"
                  />
                )}
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    placeholder="Add a comment..."
                    className="!bg-white !text-gray-900 !border-gray-300"
                  />
                  <Button
                    type="submit"
                    disabled={createCommentMutation.isPending}
                    className="!bg-blue-600 !text-white hover:!bg-blue-700"
                  >
                    {createCommentMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Post"
                    )}
                  </Button>
                </div>
              </form>

              {isLoadingComments ? (
                <CommentsSkeleton />
              ) : (
                <div className="space-y-1">
                  {comments.map((comment) => (
                    <Comment
                      key={comment.id}
                      annotation={comment}
                      currentUserId={user?.id}
                      onDelete={
                        user?.id === comment.userId
                          ? () => deleteCommentMutation.mutate(comment.id)
                          : undefined
                      }
                    />
                  ))}
                  {comments.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No comments yet. Be the first to comment!
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SharePageSkeleton() {
  return (
    <div className="min-h-screen p-8">
      <div className="container max-w-4xl mx-auto">
        <div className="text-center mb-12 space-y-4">
          <div className="h-12 w-3/4 mx-auto bg-gray-200 animate-pulse rounded-lg" />
          <div className="h-6 w-1/2 mx-auto bg-gray-200 animate-pulse rounded-lg" />
        </div>
        <div className="space-y-8">
          {[1, 2].map((i) => (
            <Card key={i} className="overflow-hidden bg-white">
              <CardContent className="p-0">
                <div className="aspect-video bg-gray-200 animate-pulse" />
                <div className="border-t">
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-gray-200 rounded animate-pulse" />
                      <div className="w-40 h-4 bg-gray-200 rounded animate-pulse" />
                    </div>
                    <div className="w-20 h-8 bg-gray-200 rounded animate-pulse" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function PasswordProtectionForm({
  onSubmit,
  isLoading
}: {
  onSubmit: (password: string) => void;
  isLoading: boolean;
}) {
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(password);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <Card className="w-full max-w-md bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900">
            <Lock className="w-5 h-5" />
            Password Protected
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              className="bg-white text-gray-900 border-gray-300"
            />
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                "Access Page"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SharePageView({ params }: { params: { slug: string } }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [password, setPassword] = useState<string>();
  const [viewMode, setViewMode] = useState<ViewMode>('large');
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);

  const { data: page, isLoading } = useQuery<SharePage>({
    queryKey: [`/api/p/${params.slug}`],
  });

  const verifyPasswordMutation = useMutation({
    mutationFn: async (password: string) => {
      const response = await apiRequest(
        "POST",
        `/api/p/${params.slug}/verify`,
        { password }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData([`/api/p/${params.slug}`], data);
    },
    onError: (error: Error) => {
      toast({
        title: "Access Denied",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (page?.titleFont) {
      loadGoogleFont(page.titleFont);
    }
    if (page?.descriptionFont) {
      loadGoogleFont(page.descriptionFont);
    }
  }, [page?.titleFont, page?.descriptionFont]);

  if (isLoading) {
    return <SharePageSkeleton />;
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

  if (page.expiresAt && new Date(page.expiresAt) < new Date()) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Page Expired</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              This share page expired on {format(new Date(page.expiresAt), 'PPP')}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (page.isPasswordProtected && !page.files) {
    return (
      <PasswordProtectionForm
        onSubmit={(password) => verifyPasswordMutation.mutate(password)}
        isLoading={verifyPasswordMutation.isPending}
      />
    );
  }

  const handleGalleryClose = () => {
    setGalleryIndex(null);
  };

  const handleGalleryNext = () => {
    if (galleryIndex === null || !page?.files) return;
    setGalleryIndex((galleryIndex + 1) % (page.files as FileObject[]).length);
  };

  const handleGalleryPrev = () => {
    if (galleryIndex === null || !page?.files) return;
    setGalleryIndex((galleryIndex - 1 + (page.files as FileObject[]).length) % (page.files as FileObject[]).length);
  };

  return (
    <div
      style={{
        backgroundColor: page.backgroundColor || "#ffffff",
        background: page.backgroundColorSecondary
          ? `linear-gradient(to bottom, ${page.backgroundColor || "#ffffff"}, ${page.backgroundColorSecondary})`
          : page.backgroundColor || "#ffffff",
        color: page.textColor || "#000000",
        minHeight: "100vh",
      }}
      className="min-h-screen relative isolate"
    >
      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        <header className="text-center mb-12">
          <h1
            className="mb-4"
            style={{
              fontFamily: page.titleFont || "Inter",
              fontSize: `${page.titleFontSize || 24}px`,
              fontWeight: "bold",
            }}
          >
            {page.title}
          </h1>
          {page.description && (
            <p
              className="opacity-90 max-w-2xl mx-auto"
              style={{
                fontFamily: page.descriptionFont || "Inter",
                fontSize: `${page.descriptionFontSize || 16}px`,
              }}
            >
              {page.description}
            </p>
          )}
        </header>


        <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-8'}>
          {(page.files as FileObject[])?.map((file, index) => (
            <FilePreview
              key={index}
              file={file}
              textColor={page.textColor || "#000000"}
              pageId={page.id}
              fileIndex={index}
              containerClassName={viewMode === 'grid' ? '' : 'w-full'}
              viewMode={viewMode}
              onGalleryOpen={() => setGalleryIndex(index)}
            />
          ))}
        </div>

        <AnimatePresence>
          {galleryIndex !== null && page.files && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center"
              onClick={handleGalleryClose}
            >
              <div className="relative w-full h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white hover:bg-black/20"
                  onClick={handleGalleryPrev}
                >
                  <ChevronLeft className="w-8 h-8" />
                </Button>
                <div className="max-w-[90vw] max-h-[90vh] bg-white rounded-lg shadow-xl">
                  <FilePreview
                    file={(page.files as FileObject[])[galleryIndex]}
                    textColor="#000000"
                    pageId={page.id}
                    fileIndex={galleryIndex}
                    viewMode="gallery"
                    containerClassName="w-full h-full"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white hover:bg-black/20"
                  onClick={handleGalleryNext}
                >
                  <ChevronRight className="w-8 h-8" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-4 top-4 text-white hover:bg-black/20"
                  onClick={handleGalleryClose}
                >
                  <X className="w-6 h-6" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}