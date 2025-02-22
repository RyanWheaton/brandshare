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
        onProgress: true
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || error.error || 'Failed to upload file to S3');
    }

    const uploadId = response.headers.get('Upload-ID');
    if (!uploadId) {
      throw new Error('No upload ID received from server');
    }

    console.log('Starting progress tracking for upload:', uploadId);
    const eventSource = new EventSource(`/api/upload/progress/${uploadId}`);

    return new Promise<string>((resolve, reject) => {
      let retries = 0;
      const maxRetries = 3;

      eventSource.onmessage = (event) => {
        try {
          console.log('Progress event received:', event.data);
          const data = JSON.parse(event.data);
          if (data.progress !== undefined) {
            setUploadProgress(Math.round(data.progress));
          }
          if (data.url) {
            console.log('Upload complete, URL received:', data.url);
            eventSource.close();
            resolve(data.url);
          }
        } catch (error) {
          console.error('Error parsing progress event:', error);
          retries++;
          if (retries >= maxRetries) {
            eventSource.close();
            reject(new Error('Failed to parse progress updates'));
          }
        }
      };

      eventSource.onerror = (error) => {
        console.error('EventSource error:', error);
        retries++;
        if (retries >= maxRetries) {
          eventSource.close();
          reject(new Error('Failed to get upload progress'));
        }
      };

      // Cleanup on unmount or error
      return () => {
        console.log('Cleaning up EventSource');
        eventSource.close();
        controller.abort();
      };
    });
  };

  const handleDropboxSelect = React.useCallback(async () => {
    if (!window.Dropbox) {
      console.error('Dropbox chooser not loaded');
      return;
    }

    window.Dropbox.choose({
      success: async (files) => {
        try {
          setIsUploading(true);
          setUploadProgress(0);

          // Upload each file to S3
          const uploadedFiles: FileObject[] = [];
          for (const file of files) {
            try {
              setCurrentFileName(file.name);
              const url = convertDropboxUrl(file.link);
              console.log('Starting upload for file:', file.name);
              const s3Url = await uploadToS3(url, file.name);
              console.log('Upload completed, S3 URL:', s3Url);

              // Create the file object
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
              throw error; // Re-throw to be caught by outer try-catch
            }
          }

          // Only call onFilesSelected if we have successfully uploaded files
          if (uploadedFiles.length > 0) {
            console.log('Calling onFilesSelected with:', uploadedFiles);
            onFilesSelected(uploadedFiles);
          }
        } catch (error) {
          console.error('Error in Dropbox upload process:', error);
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
      multiselect: true, // Enable multiple file selection
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