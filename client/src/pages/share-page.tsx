import { useQuery } from "@tanstack/react-query";
import { type SharePage, type FileObject } from "@shared/schema";
import { Loader2, FileText, Image as ImageIcon, Film } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type FilePreviewProps = {
  file: FileObject;
  textColor: string;
  containerClassName?: string;
};

export function FilePreview({ file, textColor, containerClassName = "" }: FilePreviewProps) {
  const fileType = file.name.split('.').pop();
  const isImage = fileType ? ['jpg', 'jpeg', 'png', 'gif'].includes(fileType) : false;
  const isVideo = fileType ? ['mp4', 'mov'].includes(fileType) : false;
  const isPDF = fileType === 'pdf';

  // Apply full-width styling if specified
  const wrapperClass = file.isFullWidth 
    ? "w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw]" 
    : containerClassName;

  return (
    <div className={wrapperClass}>
      <Card className={`overflow-hidden ${file.isFullWidth ? 'rounded-none' : ''}`}>
        <CardContent className="p-0">
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
            />
          ))}
        </div>
      </div>
    </div>
  );
}