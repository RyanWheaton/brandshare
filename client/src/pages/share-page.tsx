import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { type SharePage, type FileObject, type Annotation } from "@shared/schema";
import { Loader2, FileText, Image as ImageIcon, Film, MessageCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
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

export function FilePreview({ file, textColor, containerClassName = "", pageId, fileIndex }: FilePreviewProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [commentInput, setCommentInput] = useState("");
  const [guestName, setGuestName] = useState("");
  const [isCommenting, setIsCommenting] = useState(false);

  // Query annotations (comments)
  const { data: comments = [] } = useQuery<Annotation[]>({
    queryKey: [`/api/pages/${pageId}/files/${fileIndex}/annotations`],
    enabled: pageId !== undefined && fileIndex !== undefined,
  });

  // Create comment mutation
  const createCommentMutation = useMutation({
    mutationFn: async (data: { content: string; guestName?: string }) => {
      if (!pageId || fileIndex === undefined) return;
      const response = await apiRequest(
        "POST",
        `/api/pages/${pageId}/files/${fileIndex}/annotations`,
        {
          ...data,
          fileIndex,
          positionX: 0, // We don't need positions anymore
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

  // Delete comment mutation
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
          <div className="relative">
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
          </div>

          <div className="border-t">
            {/* File info and comment button */}
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

            {/* Comments section */}
            {isCommenting && (
              <div className="px-4 pb-4">
                {/* Comment form */}
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

                {/* Comments list */}
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
              </div>
            )}
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