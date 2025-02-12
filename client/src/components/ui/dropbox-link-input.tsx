import { useState } from "react";
import { Button } from "./button";
import { Input } from "./input";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { FileObject } from "@shared/schema";
import { cn } from "@/lib/utils";

interface DropboxLinkInputProps {
  onSuccess?: (file: FileObject) => void;
  className?: string;
}

const SUPPORTED_FILE_TYPES = [
  // Images
  'jpg', 'jpeg', 'png', 'gif',
  // PDFs
  'pdf',
  // Videos
  'mp4', 'mov'
];

function convertDropboxLink(url: string): string {
  if (!url.includes('dropbox.com')) {
    throw new Error('Not a valid Dropbox URL');
  }

  // Replace dl=0 with dl=1 and raw=1 with dl=1
  let convertedUrl = url
    .replace('dl=0', 'dl=1')
    .replace('raw=1', 'dl=1')
    .replace('www.dropbox.com', 'dl.dropboxusercontent.com');

  // If no dl parameter exists, add it
  if (!convertedUrl.includes('dl=1')) {
    convertedUrl += convertedUrl.includes('?') ? '&dl=1' : '?dl=1';
  }

  return convertedUrl;
}

function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

function validateFileType(filename: string): boolean {
  const extension = getFileExtension(filename);
  return SUPPORTED_FILE_TYPES.includes(extension);
}

export function DropboxLinkInput({ onSuccess, className }: DropboxLinkInputProps) {
  const [inputValue, setInputValue] = useState("");
  const { toast } = useToast();

  const addDropboxFile = useMutation({
    mutationFn: async (dropboxUrl: string) => {
      // Extract filename from Dropbox URL
      const urlParts = dropboxUrl.split('/');
      const filename = urlParts[urlParts.length - 1].split('?')[0];

      if (!validateFileType(filename)) {
        throw new Error(`Unsupported file type. Supported types are: ${SUPPORTED_FILE_TYPES.join(', ')}`);
      }

      const response = await fetch('/api/files/dropbox', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dropboxUrl }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to add Dropbox file');
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
      toast({
        title: "Success",
        description: "Dropbox file added successfully",
      });
      setInputValue("");
      onSuccess?.(data.file);
    },
    onError: (error: Error) => {
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

  return (
    <form onSubmit={handleSubmit} className={cn("flex gap-2", className)}>
      <Input
        type="text"
        placeholder="Paste Dropbox share link here..."
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
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