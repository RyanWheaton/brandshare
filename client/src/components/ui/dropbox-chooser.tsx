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
}

export function DropboxChooser({ onFilesSelected, disabled }: DropboxChooserProps) {
  const handleDropboxSelect = React.useCallback(() => {
    window.Dropbox?.choose({
      success: (files) => {
        // Convert Dropbox files to our FileObject format
        const convertedFiles: FileObject[] = files.map((file) => ({
          name: file.name,
          preview_url: file.thumbnailLink || file.link,
          url: file.link,
          isFullWidth: false,
        }));
        onFilesSelected(convertedFiles);
      },
      cancel: () => {
        // Handle cancel if needed
      },
      linkType: "preview",
      multiselect: true,
      extensions: ['images', 'pdf', 'video'],
    });
  }, [onFilesSelected]);

  return (
    <Button
      onClick={handleDropboxSelect}
      disabled={disabled}
      variant="outline"
      size="sm"
    >
      <Plus className="mr-2 h-4 w-4" />
      Add Files from Dropbox
    </Button>
  );
}