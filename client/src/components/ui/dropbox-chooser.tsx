import React from 'react';
import { Button } from "./button";
import { Plus, Loader2 } from "lucide-react";
import type { FileObject } from "@shared/schema";
import { cn, convertDropboxUrl, getFileType } from "@/lib/utils";

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

  const uploadToS3 = async (url: string, name: string) => {
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

    const data = await response.json();
    return data.url;
  };

  const handleDropboxSelect = React.useCallback(async () => {
    if (isUploading) return; // Prevent multiple selections while uploading

    window.Dropbox?.choose({
      success: async (files) => {
        try {
          setIsUploading(true);

          // Upload each file to S3
          const uploadedFiles: FileObject[] = await Promise.all(
            files.map(async (file) => {
              const fileType = getFileType(file.name);
              const url = convertDropboxUrl(file.link);

              // Upload to S3
              const s3Url = await uploadToS3(url, file.name);

              return {
                name: file.name,
                preview_url: s3Url,
                url: s3Url,
                isFullWidth: false,
                storageType: 's3' as const,
              };
            })
          );

          onFilesSelected(uploadedFiles);
        } catch (error) {
          console.error('Error uploading files to S3:', error);
          // You might want to show a toast notification here
        } finally {
          setIsUploading(false);
        }
      },
      cancel: () => {
        console.log('Dropbox file selection cancelled');
        setIsUploading(false);
      },
      linkType: "direct",
      multiselect: false,
      extensions: ['images', '.pdf'],
    });
  }, [onFilesSelected, isUploading]);

  // If children are provided, wrap them with the click handler
  if (children) {
    return (
      <div 
        onClick={!isUploading ? handleDropboxSelect : undefined} 
        className={cn(className, isUploading && "cursor-not-allowed opacity-50")}
      >
        {children}
      </div>
    );
  }

  // Default button UI
  return (
    <Button
      disabled={disabled || isUploading}
      variant="outline"
      size="sm"
      onClick={handleDropboxSelect}
      className={cn("min-w-[180px]", className)}
    >
      {isUploading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Uploading...
        </>
      ) : (
        <>
          <Plus className="mr-2 h-4 w-4" />
          Select Files from Dropbox
        </>
      )}
    </Button>
  );
}