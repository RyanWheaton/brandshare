import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function convertDropboxUrl(url: string): string {
  if (!url || !url.includes('dropbox.com')) return url;

  try {
    let convertedUrl = url
      .replace('www.dropbox.com', 'dl.dropboxusercontent.com')
      .replace(/\?dl=0(&raw=1)?/, '?raw=1')
      .replace(/\?dl=1(&raw=1)?/, '?raw=1')
      .replace('?raw=0', '?raw=1');

    // Handle /s/ links
    if (convertedUrl.includes('/s/')) {
      convertedUrl = convertedUrl.replace('dl.dropboxusercontent.com/s/', 'dl.dropboxusercontent.com/s/raw/');
    }

    // Ensure we have the correct parameter
    if (!convertedUrl.includes('raw=1') && !convertedUrl.includes('dl=1')) {
      convertedUrl += convertedUrl.includes('?') ? '&raw=1' : '?raw=1';
    }

    // Add timestamp to prevent caching issues
    const timestamp = new Date().getTime();
    convertedUrl += convertedUrl.includes('?') ? `&t=${timestamp}` : `?t=${timestamp}`;

    return convertedUrl;
  } catch (error) {
    console.error('Error converting Dropbox URL:', error);
    return url;
  }
}

// Helper to get file type
export function getFileType(filename: string): 'image' | 'pdf' | 'video' | 'other' {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (['mp4', 'mov'].includes(ext)) return 'video';
  return 'other';
}