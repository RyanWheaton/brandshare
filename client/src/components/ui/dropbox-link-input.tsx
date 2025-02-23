import { useState, useEffect, useRef } from "react";
import { Button } from "./button";
import { Input } from "./input";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { FileObject } from "@shared/schema";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import { getAllowedExtensions, formatAllowedTypes } from "@shared/file-types";

interface DropboxLinkInputProps {
  onSuccess?: (file: FileObject) => void;
  className?: string;
  value?: string;
  onChange?: (value: string) => void;
  fileType?: string;
}

function convertDropboxLink(url: string): string {
  if (!url.includes('dropbox.com')) {
    throw new Error('Not a valid Dropbox URL');
  }

  try {
    let convertedUrl = url
      .replace('www.dropbox.com', 'dl.dropboxusercontent.com')
      .replace(/\?dl=0/, '?raw=1')
      .replace(/\?dl=1/, '?raw=1')
      .replace(/\?raw=0/, '?raw=1');

    // Handle /s/ links
    if (convertedUrl.includes('/s/')) {
      convertedUrl = convertedUrl.replace('dl.dropboxusercontent.com/s/', 'dl.dropboxusercontent.com/s/raw/');
    }

    // Ensure we have the correct parameter
    if (!convertedUrl.includes('raw=1')) {
      convertedUrl += convertedUrl.includes('?') ? '&raw=1' : '?raw=1';
    }

    // Add cache-busting parameter
    const timestamp = new Date().getTime();
    convertedUrl += `&t=${timestamp}`;

    return convertedUrl;
  } catch (error) {
    console.error('Error converting Dropbox URL:', error);
    throw new Error('Failed to process Dropbox URL');
  }
}

function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

function validateFileType(filename: string): boolean {
  const ext = getFileExtension(filename);
  return getAllowedExtensions().includes(ext);
}

export function DropboxLinkInput({ onSuccess, className, value, onChange, fileType }: DropboxLinkInputProps) {
  const [inputValue, setInputValue] = useState(value || "");
  const { toast } = useToast();
  const abortControllerRef = useRef<AbortController | null>(null);
  const [location] = useLocation();
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setInputValue(value || "");
  }, [value]);

  // Force refresh when location changes
  useEffect(() => {
    setRefreshKey(prev => prev + 1);
  }, [location]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        console.log("Aborting pending Dropbox file requests...");
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  const addDropboxFile = useMutation({
    mutationFn: async (dropboxUrl: string) => {
      try {
        if (!abortControllerRef.current) {
          abortControllerRef.current = new AbortController();
        }

        const urlParts = dropboxUrl.split('/');
        const filename = urlParts[urlParts.length - 1].split('?')[0];

        if (!validateFileType(filename)) {
          throw new Error(`Unsupported file type. ${formatAllowedTypes()}`);
        }

        const response = await fetch('/api/files/dropbox', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ dropboxUrl }),
          signal: abortControllerRef.current.signal
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to add Dropbox file');
        }

        return response.json();
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          console.log("Add Dropbox file request aborted, skipping error handling.");
          return null;
        }
        throw error;
      }
    },
    onSuccess: (data) => {
      if (data === null) return;
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
      toast({
        title: "Success",
        description: "Dropbox file added successfully",
      });
      onChange?.(data.file.url);
      onSuccess?.(data.file);
    },
    onError: (error: Error) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const directUrl = convertDropboxLink(inputValue.trim());
      addDropboxFile.mutate(directUrl);
    } catch (error) {
      toast({
        title: "Error",
        description: "Please enter a valid Dropbox share link",
        variant: "destructive",
      });
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange?.(newValue);
  };

  return (
    <form onSubmit={handleSubmit} className={cn("flex gap-2", className)}>
      <Input
        type="text"
        placeholder="Paste Dropbox share link here..."
        value={inputValue}
        onChange={handleChange}
        className="flex-1"
      />
      <Button
        type="submit"
        disabled={!inputValue || addDropboxFile.isPending}
      >
        {addDropboxFile.isPending && (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        )}
        Add File
      </Button>
    </form>
  );
}