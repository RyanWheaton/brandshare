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
    // Create new abort controller for this upload
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

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
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || error.error || 'Failed to upload file to S3');
      }

      const uploadId = response.headers.get('Upload-ID');
      if (!uploadId) {
        throw new Error('No upload ID received from server');
      }

      return new Promise<string>((resolve, reject) => {
        console.log('Starting progress tracking for upload:', uploadId);
        const eventSource = new EventSource(`/api/upload/progress/${uploadId}`);
        let isCompleted = false;
        let hasReceivedFinalProgress = false;
        let urlRetryCount = 0;
        const maxUrlRetries = 5;
        const initialRetryDelay = 1000;

        const cleanup = () => {
          if (eventSource && !eventSource.CLOSED) {
            console.log('Cleaning up EventSource');
            eventSource.close();
          }
        };

        const waitForUrlWithRetry = async (retryDelay: number) => {
          try {
            console.log(`Attempting to fetch URL (attempt ${urlRetryCount + 1}/${maxUrlRetries})`);
            const urlResponse = await fetch(`/api/upload/url/${uploadId}`);

            if (urlResponse.ok) {
              const data = await urlResponse.json();
              if (data.url) {
                console.log('Successfully retrieved URL:', data.url);
                isCompleted = true;
                cleanup();
                resolve(data.url);
                return;
              }
            }

            urlRetryCount++;
            if (!isCompleted && urlRetryCount < maxUrlRetries) {
              console.log(`URL not ready, waiting ${retryDelay}ms before retry...`);
              await new Promise(r => setTimeout(r, retryDelay));
              await waitForUrlWithRetry(retryDelay * 2); // Exponential backoff
            } else if (!isCompleted) {
              throw new Error('Max retries reached waiting for URL');
            }
          } catch (error) {
            if (error instanceof Error && error.message === 'Max retries reached waiting for URL') {
              throw error;
            }

            urlRetryCount++;
            if (!isCompleted && urlRetryCount < maxUrlRetries) {
              await new Promise(r => setTimeout(r, retryDelay));
              await waitForUrlWithRetry(retryDelay * 2);
            } else {
              throw new Error('Failed to retrieve upload URL after retries');
            }
          }
        };

        let progressTimeout: NodeJS.Timeout;
        const resetProgressTimeout = () => {
          if (progressTimeout) clearTimeout(progressTimeout);
          progressTimeout = setTimeout(() => {
            if (hasReceivedFinalProgress && !isCompleted) {
              console.log('100% progress received, starting URL fetch retries');
              waitForUrlWithRetry(initialRetryDelay).catch(reject);
            } else if (!isCompleted) {
              console.log('Progress update timeout - cleaning up');
              cleanup();
              reject(new Error('Upload progress timeout'));
            }
          }, 30000);
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
                console.log('Received 100% progress, waiting for URL');
                waitForUrlWithRetry(initialRetryDelay).catch(reject);
              }
            }

            if (data.url && !isCompleted) {
              console.log('Upload complete, received S3 URL:', data.url);
              isCompleted = true;
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
          if (!isCompleted) {
            if (hasReceivedFinalProgress) {
              waitForUrlWithRetry(initialRetryDelay).catch(reject);
            } else {
              cleanup();
              reject(new Error('Failed to get upload progress'));
            }
          }
        });

        // Global timeout for entire upload process
        const uploadTimeout = setTimeout(() => {
          if (!isCompleted) {
            console.error('Upload timed out after 3 minutes');
            cleanup();
            reject(new Error('Upload timed out'));
          }
        }, 180000);

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
          let hasError = false;

          for (const file of files) {
            try {
              setCurrentFileName(file.name);
              const url = convertDropboxUrl(file.link);
              console.log('Processing file for upload:', { name: file.name, convertedUrl: url });

              const s3Url = await uploadToS3(url, file.name);
              console.log('S3 upload completed successfully:', { name: file.name, s3Url });

              if (!s3Url) {
                throw new Error(`Failed to retrieve S3 URL for ${file.name}`);
              }

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
              hasError = true;
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

            // Ensure state is updated before invalidating queries
            await new Promise(resolve => setTimeout(resolve, 100));
            await queryClient.invalidateQueries({ queryKey: ['/api/files'] });

            toast({
              title: "Success",
              description: `Successfully uploaded ${uploadedFiles.length} file${uploadedFiles.length > 1 ? 's' : ''}.`,
            });
          } else if (!hasError) {
            toast({
              title: "No Files Uploaded",
              description: "No files were successfully uploaded. Please try again.",
              variant: "destructive",
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