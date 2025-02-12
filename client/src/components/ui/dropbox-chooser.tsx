import React from 'react';
import { Button } from "./button";
import { Plus } from "lucide-react";
import type { FileObject } from "@shared/schema";

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
}

export function DropboxChooser({ onFilesSelected, disabled, className }: DropboxChooserProps) {
  const handleDropboxSelect = React.useCallback(() => {
    window.Dropbox?.choose({
      success: (files) => {
        // Convert Dropbox files to our FileObject format
        const convertedFiles: FileObject[] = files.map((file) => {
          // Always use dl=1 for all file types to ensure direct download links
          const downloadUrl = file.link
            .replace('www.dropbox.com', 'dl.dropboxusercontent.com')
            .replace('?dl=0', '?dl=1');

          // For preview URLs, ensure we're using the same format
          const previewUrl = downloadUrl;

          return {
            name: file.name,
            preview_url: previewUrl,
            url: downloadUrl,
            isFullWidth: false,
          };
        });
        onFilesSelected(convertedFiles);
      },
      cancel: () => {
        // Handle cancel if needed
      },
      linkType: "direct", // This ensures we get direct links
      multiselect: true,
      extensions: ['images', 'pdf'], // Explicitly specify PDF support
    });
  }, [onFilesSelected]);

  return (
    <Button
      onClick={handleDropboxSelect}
      disabled={disabled}
      variant="outline"
      size="sm"
      className={className}
    >
      <Plus className="mr-2 h-4 w-4" />
      Add Files from Dropbox
    </Button>
  );
}