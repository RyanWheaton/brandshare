import React from 'react';
import { Button } from "./button";
import { Plus, Loader2 } from "lucide-react";
import type { FileObject } from "@shared/schema";
import { cn, convertDropboxUrl } from "@/lib/utils";
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

  const uploadToS3 = async (url: string, name: string): Promise<string> => {
    console.log('Starting S3 upload process for:', { name, url });
    const controller = new AbortController();

    try {
      const response = await fetch('/api/upload/dropbox', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          url, 
          name,
          onProgress: true
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Upload request failed:', error);
        throw new Error(error.details || error.error || 'Failed to upload file to S3');
      }

      const uploadId = response.headers.get('Upload-ID');
      if (!uploadId) {
        console.error('No upload ID received in response headers');
        throw new Error('No upload ID received from server');
      }

      return new Promise<string>((resolve, reject) => {
        console.log('Starting progress tracking for upload:', uploadId);
        const eventSource = new EventSource(`/api/upload/progress/${uploadId}`);

        const cleanup = () => {
          console.log('Cleaning up EventSource');
          eventSource.close();
          controller.abort();
        };

        eventSource.addEventListener('message', (event) => {
          try {
            console.log('Progress event received:', event.data);
            const data = JSON.parse(event.data);

            if (data.progress !== undefined) {
              setUploadProgress(Math.round(data.progress));
            }

            if (data.url) {
              console.log('Upload complete, URL received:', data.url);
              cleanup();
              resolve(data.url);
            }
          } catch (error) {
            console.error('Error parsing progress event:', error);
            cleanup();
            reject(new Error('Failed to parse progress updates'));
          }
        });

        eventSource.addEventListener('error', (error) => {
          console.error('EventSource error:', error);
          cleanup();
          reject(new Error('Failed to get upload progress'));
        });

        // Set timeout for the upload
        const timeout = setTimeout(() => {
          console.error('Upload timed out');
          cleanup();
          reject(new Error('Upload timed out'));
        }, 300000); // 5 minutes timeout

        return () => {
          clearTimeout(timeout);
          cleanup();
        };
      });
    } catch (error) {
      console.error('Error in uploadToS3:', error);
      throw error;
    }
  };

  const handleDropboxSelect = React.useCallback(async () => {
    if (!window.Dropbox) {
      console.error('Dropbox chooser not loaded');
      return;
    }

    window.Dropbox.choose({
      success: async (files) => {
        console.log('Files selected from Dropbox:', files);
        try {
          setIsUploading(true);
          setUploadProgress(0);
          setCurrentFileName('');

          const uploadedFiles: FileObject[] = [];
          for (const file of files) {
            try {
              setCurrentFileName(file.name);
              const url = convertDropboxUrl(file.link);
              console.log('Processing file for upload:', {
                name: file.name,
                convertedUrl: url
              });

              const s3Url = await uploadToS3(url, file.name);
              console.log('S3 upload completed successfully:', {
                name: file.name,
                s3Url
              });

              const fileObject: FileObject = {
                name: file.name,
                preview_url: s3Url,
                url: s3Url,
                isFullWidth: false,
                storageType: 's3' as const,
              };
              console.log('Created FileObject:', fileObject);
              uploadedFiles.push(fileObject);
            } catch (error) {
              console.error('Error uploading file:', file.name, error);
              throw error;
            }
          }

          if (uploadedFiles.length > 0) {
            console.log('Calling onFilesSelected with:', uploadedFiles);
            onFilesSelected(uploadedFiles);
            console.log('onFilesSelected callback executed successfully');
          } else {
            console.warn('No files were successfully uploaded');
          }
        } catch (error) {
          console.error('Error in Dropbox upload process:', error);
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