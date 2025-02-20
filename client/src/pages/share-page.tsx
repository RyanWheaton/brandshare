import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { type SharePage, type FileObject, type Annotation } from "@shared/schema";
import {
  Loader2,
  FileText,
  Image as ImageIcon,
  Film,
  MessageCircle,
  Lock,
  Download,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { PDFViewer } from "@/components/ui/pdf-viewer";
import React from 'react';
import { convertDropboxUrl } from "@/lib/utils";

type CommentProps = {
  annotation: Annotation;
  onDelete?: () => void;
  currentUserId?: number;
};

function Comment({ annotation, onDelete, currentUserId }: CommentProps) {
  const displayName = annotation.userId ? "User" : (annotation.guestName || "Anonymous");
  const formattedDate = format(new Date(annotation.createdAt), 'MMM d, yyyy h:mm a');

  return (
    <div className="flex gap-3 py-3 border-t">
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <div
            className="text-sm font-medium"
            style={{ fontFamily: `var(--title-font)` }}
          >
            {displayName}
          </div>
          <div
            className="text-xs text-muted-foreground"
            style={{ fontFamily: `var(--description-font)` }}
          >
            {formattedDate}
          </div>
        </div>
        <p
          className="mt-1 text-sm"
          style={{ fontFamily: `var(--description-font)` }}
        >
          {annotation.content}
        </p>
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
};

function CommentsSkeleton() {
  return (
    <div className="space-y-4 px-4 pb-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-3 py-3 border-t">
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div className="w-24 h-4 bg-muted rounded animate-pulse" />
              <div className="w-32 h-3 bg-muted rounded animate-pulse" />
            </div>
            <div className="mt-2 space-y-2">
              <div className="w-full h-4 bg-muted rounded animate-pulse" />
              <div className="w-2/3 h-4 bg-muted rounded animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}


export function FilePreview({
  file,
  textColor,
  containerClassName = "",
  pageId,
  fileIndex,
}: FilePreviewProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isCommenting, setIsCommenting] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [guestName, setGuestName] = useState("");

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

  const renderContent = () => {
    if (isImage) {
      return (
        <div className="relative">
          <img
            src={convertDropboxUrl(file.preview_url || file.url)}
            alt={file.name}
            className="w-full h-auto max-w-4xl mx-auto"
            loading="lazy"
          />
        </div>
      );
    }

    if (isVideo) {
      const videoUrl = convertDropboxUrl(file.preview_url || file.url);
      return (
        <div className="relative aspect-video bg-muted max-w-4xl mx-auto">
          <video
            controls
            preload="metadata"
            className="w-full h-full object-contain"
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
        <div className="relative bg-muted w-full max-w-4xl mx-auto">
          <PDFViewer
            url={convertDropboxUrl(file.preview_url || file.url)}
            className="w-full min-h-[90vh] max-w-none"
          />
        </div>
      );
    }

    return (
      <div className="aspect-video flex items-center justify-center bg-muted max-w-4xl mx-auto">
        <div className="text-center p-4">
          <FileText className="w-12 h-12 mx-auto mb-2" style={{ color: textColor }} />
          <p className="text-sm font-medium" style={{ color: textColor }}>
            {file.name}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className={containerClassName}>
      <Card className="overflow-hidden border-0 shadow-none bg-transparent">
        <CardContent className="p-0">
          {renderContent()}
          <div className="max-w-4xl mx-auto mt-4">
            <div className="flex items-center justify-between pb-4">
              <div className="flex-1">
                <h3
                  className="text-lg font-semibold"
                  style={{
                    color: textColor,
                    fontFamily: `var(--title-font)`
                  }}
                >
                  {file.title || file.name}
                </h3>
                {file.description && (
                  <p
                    className="mt-2 text-sm opacity-90"
                    style={{
                      color: textColor,
                      fontFamily: `var(--description-font)`
                    }}
                  >
                    {file.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  asChild
                >
                  <a
                    href={convertDropboxUrl(file.url)}
                    download={file.name}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download</span>
                  </a>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => setIsCommenting(!isCommenting)}
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Comments</span>
                </Button>
              </div>
            </div>
          </div>

          {isCommenting && (
            <div className="max-w-4xl mx-auto mt-4 bg-card p-4 rounded-lg">
              <form onSubmit={handleCommentSubmit} className="space-y-3 mb-4">
                {!user && (
                  <Input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Your name (optional)"
                    style={{ fontFamily: `var(--description-font)` }}
                  />
                )}
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    placeholder="Add a comment..."
                    style={{ fontFamily: `var(--description-font)` }}
                  />
                  <Button
                    type="submit"
                    disabled={createCommentMutation.isPending}
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
                    <p
                      className="text-sm text-muted-foreground text-center py-4"
                      style={{ fontFamily: `var(--description-font)` }}
                    >
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
          <div className="h-12 w-3/4 mx-auto bg-muted animate-pulse rounded-lg" />
          <div className="h-6 w-1/2 mx-auto bg-muted animate-pulse rounded-lg" />
        </div>

        <div className="space-y-8">
          {[1, 2].map((i) => (
            <Card key={i} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="aspect-video bg-muted animate-pulse" />
                <div className="border-t">
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-muted rounded animate-pulse" />
                      <div className="w-40 h-4 bg-muted rounded animate-pulse" />
                    </div>
                    <div className="w-20 h-8 bg-muted rounded animate-pulse" />
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
    <div className="flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
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
  const visitStartTime = useRef<number>(Date.now());
  const isPageVisible = useRef<boolean>(true);
  const lastRecordedTime = useRef<number>(Date.now());
  const recordingInterval = useRef<number>();

  // Enhanced visit duration tracking
  useEffect(() => {
    console.log('Visit tracking started:', new Date().toISOString());

    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('Page hidden, pausing tracking');
        isPageVisible.current = false;
        // Record the duration up to this point
        recordVisitDuration();
      } else {
        console.log('Page visible, resuming tracking');
        isPageVisible.current = true;
        // Reset start time when page becomes visible again
        visitStartTime.current = Date.now();
        lastRecordedTime.current = Date.now();
      }
    };

    const recordVisitDuration = async () => {
      try {
        if (!isPageVisible.current) {
          console.log('Skipping recording - page not visible');
          return;
        }

        const now = Date.now();
        const duration = Math.floor((now - lastRecordedTime.current) / 1000); // Convert to seconds

        if (duration < 1) {
          console.log('Duration too short, skipping record');
          return;
        }

        console.log(`Recording duration: ${duration}s`);

        const response = await apiRequest(
          "POST",
          `/api/p/${params.slug}/visit-duration`,
          { duration }
        );

        if (response.ok) {
          console.log('Successfully recorded visit duration');
          lastRecordedTime.current = now;
        } else {
          console.error('Failed to record visit duration:', await response.text());
        }
      } catch (error) {
        console.error('Failed to record visit duration:', error);
      }
    };

    // Record duration every minute while the page is visible
    recordingInterval.current = window.setInterval(() => {
      if (isPageVisible.current) {
        recordVisitDuration();
      }
    }, 60000); // Every minute

    // Set up event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', () => {
      console.log('Page unloading, recording final duration');
      recordVisitDuration();
    });

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.clearInterval(recordingInterval.current);
      // Record final duration when component unmounts
      recordVisitDuration();
    };
  }, [params.slug]);

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
    if (page?.titleFont || page?.descriptionFont) {
      window.sharePageFonts = {
        titleFont: page.titleFont || "Inter",
        descriptionFont: page.descriptionFont || "Inter",
      };
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

  if (page.password && !page.files) {
    return (
      <PasswordProtectionForm
        onSubmit={(password) => verifyPasswordMutation.mutate(password)}
        isLoading={verifyPasswordMutation.isPending}
      />
    );
  }

  return (
    <div
      style={{
        backgroundColor: page.backgroundColor || "#ffffff",
        background: page.backgroundColorSecondary
          ? `linear-gradient(to bottom, ${page.backgroundColor || "#ffffff"}, ${page.backgroundColorSecondary})`
          : page.backgroundColor || "#ffffff",
        color: page.textColor || "#000000",
        minHeight: "100vh",
        "--title-font": `${page.titleFont || "Inter"}`,
        "--description-font": `${page.descriptionFont || "Inter"}`,
      } as React.CSSProperties}
      className="min-h-screen relative"
    >
      <div className="mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <header className="max-w-4xl mx-auto text-center mb-12">
          {page.logoUrl && (
            <div className="mb-8">
              <img
                src={page.logoUrl}
                alt="Logo"
                className="mx-auto object-contain"
                style={{
                  maxWidth: page.logoSize || 200,
                  maxHeight: page.logoSize || 200
                }}
              />
            </div>
          )}
          <h1
            style={{
              fontSize: `${page.titleFontSize || 24}px`,
              fontWeight: "bold",
              fontFamily: `var(--title-font)`
            }}
            className="mb-4"
          >
            {page.title}
          </h1>
          {page.description && (
            <p
              style={{
                fontSize: `${page.descriptionFontSize || 16}px`,
                fontFamily: `var(--description-font)`
              }}
              className="opacity-90 prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: page.description }}
            />
          )}
        </header>

        <div className="space-y-8">
          {(page.files as FileObject[])?.map((file, index) => (
            <FilePreview
              key={index}
              file={file}
              textColor={page.textColor || "#000000"}
              pageId={page.id}
              fileIndex={index}
              containerClassName="w-full"
            />
          ))}
        </div>
      </div>

      {page.showFooter && (page.footerText || page.footerBackgroundColor || page.footerLogoUrl) && (
        <footer
          style={{
            backgroundColor: page.footerBackgroundColor || "#f3f4f6",
            color: page.footerTextColor || "#000000",
          }}
          className="w-full py-6 px-4 mt-8"
        >
          <div className="max-w-4xl mx-auto">
            {page.footerLogoUrl && (
              <div className="mb-6 flex justify-center">
                {page.footerLogoLink ? (
                  <a
                    href={page.footerLogoLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <img
                      src={convertDropboxUrl(page.footerLogoUrl)}
                      alt="Footer Logo"
                      className="mx-auto object-contain"
                      style={{
                        maxWidth: page.footerLogoSize || 150,
                        maxHeight: page.footerLogoSize || 150
                      }}
                    />
                  </a>
                ) : (
                  <img
                    src={convertDropboxUrl(page.footerLogoUrl)}
                    alt="Footer Logo"
                    className="mx-auto object-contain"
                    style={{
                      maxWidth: page.footerLogoSize || 150,
                      maxHeight: page.footerLogoSize || 150
                    }}
                  />
                )}
              </div>
            )}
            {page.footerText && (
              <div
                className="prose prose-sm max-w-none"
                style={{
                  color: page.footerTextColor || "#000000",
                }}
              >
                <p
                  className="description-font"
                  style={{ textAlign: 'center' }}
                  dangerouslySetInnerHTML={{ __html: page.footerText }}
                />
              </div>
            )}
          </div>
        </footer>
      )}
    </div>
  );
}

declare global {
  interface Window {
    sharePageFonts?: {
      titleFont: string;
      descriptionFont: string;
    };
  }
}