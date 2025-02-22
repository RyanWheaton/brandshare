import React from 'react';
import { Button } from "./button";
import { Plus, Loader2 } from "lucide-react";
import type { FileObject } from "@shared/schema";
import { cn, convertDropboxUrl } from "@/lib/utils";
import { Progress } from "./progress";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

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
  const abortControllerRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        console.log("Aborting pending Dropbox file requests...");
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  const uploadToS3 = async (url: string, name: string): Promise<string> => {
    try {
      if (!abortControllerRef.current) {
        abortControllerRef.current = new AbortController();
      }

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
        signal: abortControllerRef.current.signal
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
        let isCompleted = false;
        let hasReceivedFinalProgress = false;

        const cleanup = () => {
          if (eventSource && !isCompleted) {
            console.log('Cleaning up EventSource');
            eventSource.close();
          }
        };

        const waitForUrlWithRetry = async () => {
          let retryCount = 0;
          const maxRetries = 5;
          let delay = 1000; // Start with 1 second delay

          while (retryCount < maxRetries && !isCompleted) {
            try {
              console.log(`Attempting to fetch URL (attempt ${retryCount + 1}/${maxRetries})`);
              const urlResponse = await fetch(`/api/upload/url/${uploadId}`);

              if (urlResponse.ok) {
                const data = await urlResponse.json();
                if (data.url) {
                  console.log('Successfully retrieved URL:', data.url);
                  isCompleted = true;
                  eventSource.close();
                  resolve(data.url);
                  return;
                }
              }

              retryCount++;
              if (!isCompleted && retryCount < maxRetries) {
                console.log(`URL not ready, waiting ${delay}ms before retry...`);
                await new Promise(r => setTimeout(r, delay));
                delay *= 2; // Exponential backoff
              }
            } catch (error) {
              console.error(`Error fetching URL on attempt ${retryCount + 1}:`, error);
              retryCount++;
              if (!isCompleted && retryCount < maxRetries) {
                await new Promise(r => setTimeout(r, delay));
                delay *= 2;
              }
            }
          }

          if (!isCompleted) {
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
              eventSource.close();
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
          if (error instanceof Event && !isCompleted) {
            if (hasReceivedFinalProgress) {
              console.log('Got error after 100% progress, starting URL fetch retries');
              waitForUrlWithRetry();
              return;
            }

            console.error('EventSource error:', error);
            clearTimeout(progressTimeout);
            cleanup();
            reject(new Error('Failed to get upload progress'));
          }
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
              console.log('Processing file for upload:', { name: file.name, convertedUrl: url });

              const s3Url = await uploadToS3(url, file.name);
              console.log('S3 upload completed successfully:', { name: file.name, s3Url });

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
              console.error('Error uploading file:', file.name, error);
              toast({
                title: "Upload Failed",
                description: `Failed to upload ${file.name}: ${errorMessage}`,
                variant: "destructive",
              });
            }
          }

          if (uploadedFiles.length > 0) {
            console.log('Updating app state with uploaded files:', uploadedFiles);
            onFilesSelected(uploadedFiles);
            queryClient.invalidateQueries({ queryKey: ['/api/files'] });

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