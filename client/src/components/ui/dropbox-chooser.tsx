import React from 'react';
import { Button } from "./button";
import { Input } from "./input";
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

function convertDropboxUrlToRaw(url: string): string {
  // Parse the URL to maintain its structure
  try {
    const urlObj = new URL(url);

    // Get the search params
    const params = new URLSearchParams(urlObj.search);

    // Remove the st parameter if it exists
    params.delete('st');

    // Replace dl=0 with raw=1
    params.delete('dl');
    params.append('raw', '1');

    // Reconstruct the URL with the modified parameters
    urlObj.search = params.toString();
    return urlObj.toString();
  } catch (error) {
    console.error('Invalid URL:', error);
    return url;
  }
}

export function DropboxChooser({ onFilesSelected, disabled }: DropboxChooserProps) {
  const [shareUrl, setShareUrl] = React.useState('');

  const handleDropboxSelect = React.useCallback(() => {
    window.Dropbox?.choose({
      success: (files) => {
        // Convert Dropbox files to our FileObject format
        const convertedFiles: FileObject[] = files.map((file) => ({
          name: file.name,
          preview_url: file.link.replace('?dl=0', '?raw=1'), // Use raw=1 for direct image display
          url: file.link.replace('?dl=0', '?dl=1'), // Force direct download URL
          isFullWidth: false,
        }));
        onFilesSelected(convertedFiles);
      },
      cancel: () => {
        // Handle cancel if needed
      },
      linkType: "direct", // This ensures we get direct links
      multiselect: true,
      extensions: ['images'], // Only allow image files
    });
  }, [onFilesSelected]);

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareUrl.trim()) return;

    // Extract filename from URL
    const fileName = shareUrl.split('/').pop()?.split('?')[0] || 'file';

    // Convert the share URL to raw URL
    const rawUrl = convertDropboxUrlToRaw(shareUrl);

    const newFile: FileObject = {
      name: decodeURIComponent(fileName),
      preview_url: rawUrl,
      url: rawUrl.replace('raw=1', 'dl=1'),
      isFullWidth: false,
    };

    onFilesSelected([newFile]);
    setShareUrl('');
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleUrlSubmit} className="flex gap-2">
        <Input
          type="text"
          placeholder="Paste Dropbox share URL"
          value={shareUrl}
          onChange={(e) => setShareUrl(e.target.value)}
          className="flex-1"
        />
        <Button 
          type="submit" 
          disabled={!shareUrl.trim() || disabled}
          variant="secondary"
          size="sm"
        >
          Add URL
        </Button>
      </form>

      <Button
        onClick={handleDropboxSelect}
        disabled={disabled}
        variant="outline"
        size="sm"
        className="w-full"
      >
        <Plus className="mr-2 h-4 w-4" />
        Choose from Dropbox
      </Button>
    </div>
  );
}