import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { type SharePage, type FileObject, type Annotation } from "@shared/schema";
import { Loader2, FileText, Image as ImageIcon, Film, MessageCircle, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import React from 'react';
import { PDFViewer } from "@/components/ui/pdf-viewer";

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
          <div className="text-sm font-medium">{displayName}</div>
          <div className="text-xs text-muted-foreground">{formattedDate}</div>
        </div>
        <p className="mt-1 text-sm">{annotation.content}</p>
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

export function FilePreview({ file, textColor, containerClassName = "", pageId, fileIndex }: FilePreviewProps) {
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
        <div className="relative">
          <img
            src={convertDropboxUrl(file.preview_url || file.url)}
            alt={file.name}
            className={`w-full h-auto ${!file.isFullWidth ? 'max-w-4xl mx-auto' : ''}`}
            loading="lazy"
          />
        </div>
      );
    }

    if (isVideo) {
      const videoUrl = convertDropboxUrl(file.preview_url || file.url);
      return (
        <div className={`relative aspect-video bg-muted ${!file.isFullWidth ? 'max-w-4xl mx-auto' : ''}`}>
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
        <div className={`relative bg-muted w-full ${!file.isFullWidth ? 'max-w-4xl mx-auto' : ''}`}>
          <PDFViewer
            url={convertDropboxUrl(file.preview_url || file.url)}
            className="w-full min-h-[90vh] max-w-none"
            style={{ transform: 'none' }}
          />
        </div>
      );
    }

    // Fallback for unsupported file types
    return (
      <div className={`aspect-video flex items-center justify-center bg-muted ${!file.isFullWidth ? 'max-w-4xl mx-auto' : ''}`}>
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
      <Card className={`overflow-hidden border-0 shadow-none ${file.isFullWidth ? 'bg-transparent' : 'bg-card max-w-4xl mx-auto'}`}>
        <CardContent className="p-0">
          {renderContent()}
          <div className={`border-t ${file.isFullWidth ? 'max-w-4xl mx-auto bg-card' : ''}`}>
            <div className="p-4 flex items-center justify-between">
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
                className="gap-2"
                onClick={() => setIsCommenting(!isCommenting)}
              >
                <MessageCircle className="w-4 h-4" />
                <span>{comments.length}</span>
              </Button>
            </div>
          </div>

          {isCommenting && (
            <div className="px-4 pb-4 bg-card">
              <form onSubmit={handleCommentSubmit} className="space-y-3 mb-4">
                {!user && (
                  <Input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Your name (optional)"
                  />
                )}
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    placeholder="Add a comment..."
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
                    <p className="text-sm text-muted-foreground text-center py-4">
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
      className="min-h-screen"
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
    </div>
  );
}