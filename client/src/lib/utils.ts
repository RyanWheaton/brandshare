import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function convertDropboxUrl(url: string): string {
  if (!url.includes('dropbox.com')) return url;
  let convertedUrl = url
    .replace('?dl=0', '?dl=1')
    .replace('?raw=1', '?dl=1')
    .replace('www.dropbox.com', 'dl.dropboxusercontent.com');
  if (!convertedUrl.includes('dl=1')) {
    convertedUrl += convertedUrl.includes('?') ? '&dl=1' : '?dl=1';
  }
  return convertedUrl;
}