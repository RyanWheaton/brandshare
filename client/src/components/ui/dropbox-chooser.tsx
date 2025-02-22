import React from 'react';
import { Button } from "./button";
import { Plus, Loader2 } from "lucide-react";
import type { FileObject } from "@shared/schema";
import { cn, convertDropboxUrl } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Progress } from "@/components/ui/progress";

declare global {
  interface Window {
    Dropbox: {
      choose: (options: {
        success: (files: any[]) => void;
        cancel: () => void;
        linkType: "preview" | "direct";
        multiselect: boolean;
        extensions: string[];
      }) => void;
    };
  }
}

interface DropboxChooserProps {
  onFilesSelected: (files: FileObject[]) => void;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function DropboxChooser({ onFilesSelected, disabled, className, children }: DropboxChooserProps) {
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [currentFileName, setCurrentFileName] = React.useState("");
  const { toast } = useToast();

  React.useEffect(() => {
    console.log('Component mounted');
    console.log('Initial state:', { isUploading, uploadProgress, currentFileName });
  }, []);

  React.useEffect(() => {
    console.log('State updated:', { isUploading, uploadProgress, currentFileName });
  }, [isUploading, uploadProgress, currentFileName]);

  const uploadToS3 = async (url: string, name: string) => {
    setCurrentFileName(name);
    setUploadProgress(0);
    console.log('Starting upload to S3:', { url, name });

    const response = await fetch('/api/upload/dropbox', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, name }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || error.error || 'Failed to upload file to S3');
    }

    // Simulate upload progress
    for (let progress = 10; progress <= 100; progress += 10) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      console.log('Setting progress:', progress);
      setUploadProgress(progress);
    }

    const data = await response.json();
    return data.url;
  };

  const handleDropboxSelect = React.useCallback(async () => {
    window.Dropbox?.choose({
      success: async (files) => {
        try {
          console.log('Dropbox files selected:', files);
          setIsUploading(true);
          setUploadProgress(0);

          const uploadedFiles: FileObject[] = [];

          for (const file of files) {
            setCurrentFileName(file.name);
            const url = convertDropboxUrl(file.link);

            try {
              const s3Url = await uploadToS3(url, file.name);

              if (!s3Url) {
                console.error(`Failed to retrieve S3 URL for ${file.name}`);
                continue;
              }

              const fileObject: FileObject = {
                name: file.name,
                preview_url: s3Url,
                url: s3Url,
                isFullWidth: false,
                storageType: 's3' as const,
              };

              uploadedFiles.push(fileObject);
            } catch (error) {
              console.error('Error uploading file:', file.name, error);
              toast({
                title: "Upload Failed",
                description: `Failed to upload ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
                variant: "destructive",
              });
            }
          }

          if (uploadedFiles.length > 0) {
            onFilesSelected(uploadedFiles);
            await queryClient.invalidateQueries({ queryKey: ['/api/files'] });

            toast({
              title: "Success",
              description: `Successfully uploaded ${uploadedFiles.length} files.`,
            });
          }
        } catch (error) {
          console.error('Error in Dropbox upload process:', error);
          toast({
            title: "Error",
            description: "Failed to process Dropbox files",
            variant: "destructive",
          });
        } finally {
          setIsUploading(false);
          setUploadProgress(0);
          setCurrentFileName('');
        }
      },
      cancel: () => {
        console.log('Dropbox file selection cancelled');
      },
      linkType: "direct",
      multiselect: true,
      extensions: ['images', '.pdf'],
    });
  }, [onFilesSelected, toast]);

  // Test render with a static progress value
  if (process.env.NODE_ENV === 'development') {
    console.log('Rendering DropboxChooser with states:', {
      isUploading,
      uploadProgress,
      currentFileName
    });
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Button
        onClick={handleDropboxSelect}
        disabled={disabled || isUploading}
        variant="outline"
        size="sm"
        className="w-full"
      >
        {isUploading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Plus className="mr-2 h-4 w-4" />
        )}
        {isUploading ? `Uploading ${currentFileName}...` : "Select Files from Dropbox"}
      </Button>

      {isUploading && (
        <div className="w-full">
          <Progress value={uploadProgress} className="h-2" />
          <p className="text-sm text-muted-foreground mt-1 text-center">
            {uploadProgress}%
          </p>
        </div>
      )}
    </div>
  );
}