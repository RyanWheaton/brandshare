import React from 'react';
import { Button } from "./button";
import { Plus, Loader2 } from "lucide-react";
import type { FileObject } from "@shared/schema";
import { cn, convertDropboxUrl, getFileType } from "@/lib/utils";
import { Progress } from "./progress";

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
  const [currentFileName, setCurrentFileName] = React.useState<string>('');

  const uploadToS3 = async (url: string, name: string) => {
    const controller = new AbortController();
    const response = await fetch('/api/upload/dropbox', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        url, 
        name,
        onProgress: true // Signal that we want progress updates
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || error.error || 'Failed to upload file to S3');
    }

    // Set up event source for progress updates
    const uploadId = response.headers.get('Upload-ID');
    if (!uploadId) {
      throw new Error('No upload ID received from server');
    }

    const eventSource = new EventSource(`/api/upload/progress/${uploadId}`);

    return new Promise<string>((resolve, reject) => {
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.progress !== undefined) {
            setUploadProgress(Math.round(data.progress));
          }
          if (data.url) {
            eventSource.close();
            resolve(data.url);
          }
        } catch (error) {
          console.error('Error parsing progress event:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('EventSource error:', error);
        eventSource.close();
        reject(new Error('Failed to get upload progress'));
      };

      // Cleanup on unmount or error
      return () => {
        eventSource.close();
        controller.abort();
      };
    });
  };

  const handleDropboxSelect = React.useCallback(async () => {
    window.Dropbox?.choose({
      success: async (files) => {
        try {
          setIsUploading(true);
          setUploadProgress(0);

          // Upload each file to S3
          const uploadedFiles: FileObject[] = [];
          for (const file of files) {
            setCurrentFileName(file.name);
            const url = convertDropboxUrl(file.link);
            const s3Url = await uploadToS3(url, file.name);

            uploadedFiles.push({
              name: file.name,
              preview_url: s3Url,
              url: s3Url,
              isFullWidth: false,
              storageType: 's3' as const,
            });
          }

          onFilesSelected(uploadedFiles);
        } catch (error) {
          console.error('Error uploading files to S3:', error);
          // You might want to show a toast notification here
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
      multiselect: false,
      extensions: ['images', '.pdf'],
    });
  }, [onFilesSelected]);

  return (
    <div className="space-y-2">
      <div onClick={handleDropboxSelect} className={cn(className)}>
        {children || (
          <Button
            disabled={disabled || isUploading}
            variant="outline"
            size="sm"
            className={cn(className)}
          >
            {isUploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            {isUploading ? "Uploading..." : "Select Files from Dropbox"}
          </Button>
        )}
      </div>

      {isUploading && (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">
            Uploading {currentFileName}...
          </div>
          <Progress value={uploadProgress} className="h-2" />
          <div className="text-xs text-muted-foreground text-right">
            {Math.round(uploadProgress)}%
          </div>
        </div>
      )}
    </div>
  );
}