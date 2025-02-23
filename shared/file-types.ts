export const ALLOWED_FILE_TYPES = {
  // Image files
  'image/png': ['png'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/gif': ['gif'],
  'image/svg+xml': ['svg'],
  'image/webp': ['webp'],
  // PDF files
  'application/pdf': ['pdf'],
  // Video files
  'video/mp4': ['mp4'],
  'video/quicktime': ['mov'],
  'video/x-msvideo': ['avi'],
  'video/x-matroska': ['mkv']
} as const;

// Helper functions
export function isAllowedMimeType(mimeType: string): boolean {
  return Object.keys(ALLOWED_FILE_TYPES).includes(mimeType);
}

export function getExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

export function isAllowedFileType(filename: string, mimeType: string): boolean {
  const ext = getExtension(filename);
  if (!ext) return false;

  // Special handling for PDF files
  if (ext === 'pdf' && (mimeType === 'application/pdf' || mimeType === 'application/octet-stream')) {
    return true;
  }

  // For other file types
  const allowedExts = ALLOWED_FILE_TYPES[mimeType as keyof typeof ALLOWED_FILE_TYPES] || [];
  return allowedExts.includes(ext as any);
}

export function getAllowedExtensions(): string[] {
  return Object.values(ALLOWED_FILE_TYPES).flat();
}

export function formatAllowedTypes(): string {
  const extensions = getAllowedExtensions();
  return `Allowed file types: ${extensions.join(', ')}`;
}