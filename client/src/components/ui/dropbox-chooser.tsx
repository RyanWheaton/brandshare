import React from 'react';
import { Button } from "./button";
import { Plus, Loader2 } from "lucide-react";
import type { FileObject } from "@shared/schema";
import { cn, convertDropboxUrl } from "@/lib/utils";
import { Progress } from "./progress";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();

  const uploadToS3 = async (url: string, name: string): Promise<string> => {
    console.log('Starting S3 upload process:', { name, url });
    const controller = new AbortController();
    let eventSource: EventSource | null = null;
    let isCompleted = false;
    let hasReceivedFinalProgress = false;
    let retryCount = 0;
    const MAX_RETRIES = 3;

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
        eventSource = new EventSource(`/api/upload/progress/${uploadId}`);

        const cleanup = () => {
          if (eventSource && !isCompleted) {
            console.log('Cleaning up EventSource');
            eventSource.close();
            eventSource = null;
            controller.abort();
          }
        };

        const waitForUrlWithRetry = async () => {
          if (isCompleted || retryCount >= MAX_RETRIES) return;

          retryCount++;
          console.log(`Attempting to fetch URL (attempt ${retryCount}/${MAX_RETRIES})`);

          try {
            const urlResponse = await fetch(`/api/upload/url/${uploadId}`);
            if (urlResponse.ok) {
              const data = await urlResponse.json();
              if (data.url) {
                console.log('Successfully retrieved URL on retry:', data.url);
                isCompleted = true;
                if (eventSource) {
                  eventSource.close();
                  eventSource = null;
                }
                resolve(data.url);
                return;
              }
            }
          } catch (error) {
            console.error(`Failed to fetch URL on attempt ${retryCount}:`, error);
          }

          if (retryCount < MAX_RETRIES) {
            setTimeout(waitForUrlWithRetry, 2000); // Wait 2 seconds before retrying
          } else {
            cleanup();
            reject(new Error('Failed to retrieve upload URL after retries'));
          }
        };

        let progressTimeout: NodeJS.Timeout;
        const resetProgressTimeout = () => {
          if (progressTimeout) clearTimeout(progressTimeout);
          if (!isCompleted) {
            progressTimeout = setTimeout(() => {
              if (hasReceivedFinalProgress && !isCompleted) {
                console.log('100% progress received, starting URL fetch retries');
                waitForUrlWithRetry();
                return;
              }

              console.log('Progress update timeout - cleaning up');
              cleanup();
              reject(new Error('Upload progress timeout'));
            }, 30000); // 30 second timeout for progress updates
          }
        };

        resetProgressTimeout();

        eventSource.addEventListener('message', (event) => {
          try {
            console.log('Progress event received:', event.data);
            const data = JSON.parse(event.data);
            resetProgressTimeout();

            if (data.progress !== undefined) {
              const progress = Math.round(data.progress);
              setUploadProgress(progress);
              if (progress === 100) {
                hasReceivedFinalProgress = true;
                console.log('Received 100% progress, initiating URL fetch');
                waitForUrlWithRetry();
              }
            }

            if (data.url) {
              console.log('Upload complete, received S3 URL:', data.url);
              isCompleted = true;
              clearTimeout(progressTimeout);
              if (eventSource) {
                eventSource.close();
                eventSource = null;
              }
              resolve(data.url);
            }
          } catch (error) {
            console.error('Error parsing progress event:', error);
            clearTimeout(progressTimeout);
            cleanup();
            reject(new Error('Failed to parse progress updates'));
          }
        });

        eventSource.addEventListener('error', (error) => {
          if (isCompleted) return;

          if (hasReceivedFinalProgress) {
            console.log('Got error after 100% progress, starting URL fetch retries');
            waitForUrlWithRetry();
            return;
          }

          console.error('EventSource error:', error);
          clearTimeout(progressTimeout);
          cleanup();
          reject(new Error('Failed to get upload progress'));
        });

        // Global timeout for entire upload process
        const uploadTimeout = setTimeout(() => {
          if (!isCompleted) {
            console.error('Upload timed out after 3 minutes');
            clearTimeout(progressTimeout);
            cleanup();
            reject(new Error('Upload timed out'));
          }
        }, 180000); // 3 minutes timeout

        return () => {
          clearTimeout(progressTimeout);
          clearTimeout(uploadTimeout);
          cleanup();
        };
      });
    } catch (error) {
      if (eventSource && !isCompleted) eventSource.close();
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
          const errors: Array<{ file: string; error: string }> = [];

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
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              errors.push({ file: file.name, error: errorMessage });
              console.error('Error uploading file:', file.name, error);
            }
          }

          // Always update state with successfully uploaded files
          if (uploadedFiles.length > 0) {
            console.log('Updating app state with uploaded files:', uploadedFiles);
            onFilesSelected(uploadedFiles);
          }

          // Show appropriate toast message
          if (errors.length > 0) {
            if (uploadedFiles.length > 0) {
              toast({
                title: "Partial Upload Success",
                description: `Successfully uploaded ${uploadedFiles.length} out of ${files.length} files.`,
              });
            }

            // Show individual error messages
            errors.forEach(({ file, error }) => {
              toast({
                title: `Failed to upload ${file}`,
                description: error,
                variant: "destructive",
              });
            });
          } else {
            toast({
              title: "Success",
              description: `Successfully uploaded ${files.length} files.`,
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

  return (
    <div className="space-y-2">
      <div onClick={handleDropboxSelect} className={cn(className)}>
        {children || (
          <Button
            type="button"
            disabled={disabled || isUploading}
            variant="outline"
            size="sm"
            className={cn("gap-2", className)}
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