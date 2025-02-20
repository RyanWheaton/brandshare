import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function convertDropboxUrl(url: string): string {
  if (!url || !url.includes('dropbox.com')) return url;

  try {
    let convertedUrl = url;

    // Handle various Dropbox URL formats
    if (convertedUrl.includes('www.dropbox.com')) {
      // Convert to dl.dropboxusercontent.com
      convertedUrl = convertedUrl
        .replace('www.dropbox.com', 'dl.dropboxusercontent.com')
        .replace('?dl=0', '')
        .replace('?dl=1', '')
        .replace('?raw=1', '');

      // Special handling for /s/ links
      if (convertedUrl.includes('/s/')) {
        convertedUrl = convertedUrl.replace('dl.dropboxusercontent.com/s/', 'dl.dropboxusercontent.com/s/raw/');
      }

      // Add dl=1 parameter for direct download
      convertedUrl += convertedUrl.includes('?') ? '&dl=1' : '?dl=1';
    }

    // Handle already converted URLs
    if (convertedUrl.includes('dl.dropboxusercontent.com') && !convertedUrl.includes('dl=1')) {
      convertedUrl += convertedUrl.includes('?') ? '&dl=1' : '?dl=1';
    }

    return convertedUrl;
  } catch (err) {
    console.error('Error converting Dropbox URL:', err);
    return url;
  }
}