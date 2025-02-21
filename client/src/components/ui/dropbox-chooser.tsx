import React from 'react';
import { Button } from "./button";
import { Plus } from "lucide-react";
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
  const handleDropboxSelect = React.useCallback(() => {
    window.Dropbox?.choose({
      success: (files) => {
        // Convert Dropbox files to our FileObject format
        const convertedFiles: FileObject[] = files.map((file) => {
          const fileType = getFileType(file.name);

          // For images, use raw=1 to get direct display URL
          // For PDFs, use dl=1 to get downloadable URL
          const url = convertDropboxUrl(file.link);
          let previewUrl = url;

          // For images, ensure we're using raw=1 for direct display
          if (fileType === 'image') {
            previewUrl = url.replace('dl=1', 'raw=1');
          }

          return {
            name: file.name,
            preview_url: previewUrl,
            url: url,
            isFullWidth: false,
          };
        });

        // Log the converted files for debugging
        console.log('Converted Dropbox files:', convertedFiles);

        onFilesSelected(convertedFiles);
      },
      cancel: () => {
        console.log('Dropbox file selection cancelled');
      },
      linkType: "direct", // This ensures we get direct links
      multiselect: false, // Only allow single file selection
      extensions: ['images', '.pdf'], // Allow both images and PDF files
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