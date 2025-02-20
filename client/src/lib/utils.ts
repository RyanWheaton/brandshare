import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function convertDropboxUrl(url: string, forPreview: boolean = false): string {
  if (!url || !url.includes('dropbox.com')) return url;

  try {
    let convertedUrl = url;

    // Extract the file path from the Dropbox URL
    const pathMatch = url.match(/\/s\/[^?]+|\/view\/[^?/]+\/[^?]+/);
    if (!pathMatch) return url;

    const filePath = pathMatch[0];

    // Handle viewing URLs differently from download URLs
    if (forPreview || url.includes('/view/')) {
      // For preview/view URLs, use dl.dropboxusercontent.com without dl=1
      convertedUrl = `https://dl.dropboxusercontent.com${filePath}`;

      // Remove any existing parameters
      convertedUrl = convertedUrl.split('?')[0];

      // Don't add dl=1 for preview URLs
      return convertedUrl;
    } else {
      // For download URLs, use the standard conversion
      convertedUrl = `https://dl.dropboxusercontent.com${filePath}`;

      // Remove any existing parameters
      convertedUrl = convertedUrl.split('?')[0];

      // Add dl=1 for direct download
      convertedUrl += '?dl=1';

      return convertedUrl;
    }
  } catch (err) {
    console.error('Error converting Dropbox URL:', err);
    return url;
  }
}