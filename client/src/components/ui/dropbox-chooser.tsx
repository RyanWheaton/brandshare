import React from 'react';
import { Button } from "./button";
import { Plus } from "lucide-react";
import type { FileObject } from "@shared/schema";
import { cn } from "@/lib/utils";
import { convertDropboxUrl } from "@/lib/utils";

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
  const handleDropboxSelect = React.useCallback(() => {
    window.Dropbox?.choose({
      success: (files) => {
        // Convert Dropbox files to our FileObject format
        const convertedFiles: FileObject[] = files.map((file) => {
          const isImage = /\.(jpg|jpeg|png|gif)$/i.test(file.name);

          // Use forPreview=true for preview URLs of images
          const previewUrl = convertDropboxUrl(file.link, true);
          // Use forPreview=false for direct download URLs
          const directUrl = convertDropboxUrl(file.link, false);

          return {
            name: file.name,
            preview_url: previewUrl,
            url: directUrl,
            isFullWidth: false,
          };
        });
        onFilesSelected(convertedFiles);
      },
      cancel: () => {
        // Handle cancel if needed
      },
      linkType: "direct", // This ensures we get direct links
      multiselect: true, // Allow multiple file selection
      extensions: ['images', '.pdf', '.mp4', '.mov'], // Allow images, PDFs, and videos
    });
  }, [onFilesSelected]);

  return (
    <div onClick={handleDropboxSelect} className={cn(className)}>
      {children || (
        <Button
          disabled={disabled}
          variant="outline"
          size="sm"
          className={cn(className)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Select Files from Dropbox
        </Button>
      )}
    </div>
  );
}