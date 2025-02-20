import React from 'react';
import { Button } from "./button";
import { Plus } from "lucide-react";
import type { FileObject } from "@shared/schema";
import { cn } from "@/lib/utils";

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
          let previewUrl = file.link;
          if (file.name.toLowerCase().endsWith('.pdf')) {
            previewUrl = file.link.replace('www.dropbox.com', 'dl.dropboxusercontent.com');
            if (!previewUrl.includes('dl=1')) {
              previewUrl += previewUrl.includes('?') ? '&dl=1' : '?dl=1';
            }
          } else {
            // For other files (images), use raw=1 for preview
            previewUrl = file.link.replace('?dl=0', '?raw=1');
          }

          return {
            name: file.name,
            preview_url: previewUrl,
            url: file.link.replace('?dl=0', '?dl=1').replace('www.dropbox.com', 'dl.dropboxusercontent.com'),
            isFullWidth: false,
          };
        });
        onFilesSelected(convertedFiles);
      },
      cancel: () => {
        // Handle cancel if needed
      },
      linkType: "direct", // This ensures we get direct links
      multiselect: false, // Only allow single file selection
      extensions: ['images'], // Only allow image files
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